'use client';

import React, { useState, useEffect, useRef } from 'react';
import { PhoneDialerApp } from '@/components/telephony/PhoneDialerApp';
import {
  PhoneCall,
  Phone,
  Users,
  Clock,
  Activity,
  LogOut,
  Download,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { AuthScreen } from '@/components/AuthScreen';
import { DirectoryTab } from '@/components/DirectoryTab';
import { CallHistoryTab } from '@/components/CallHistoryTab';
import { DiagnosticsTab } from '@/components/DiagnosticsTab';
import { IncomingCallModal } from '@/components/IncomingCallModal';
import { ActiveCallModal } from '@/components/ActiveCallModal';
import { WebRTCClient, WebRTCDiagnostics } from '@/lib/webrtcClient';
import { toneGenerator } from '@/lib/tones';
import { CallRecord } from '@/lib/db';

export default function Home() {
  const [token, setToken] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // App Tabs: 'phone' | 'directory' | 'history' | 'diagnostics'
  const [activeTab, setActiveTab] = useState<'phone' | 'directory' | 'history' | 'diagnostics'>('phone');

  // Directory & Presence
  const [registeredUsers, setRegisteredUsers] = useState<Array<{ username: string; displayName: string }>>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [userStates, setUserStates] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Call History
  const [callHistory, setCallHistory] = useState<CallRecord[]>([]);

  // Active Call State
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callState, setCallState] = useState<'idle' | 'calling' | 'ringing' | 'in_call'>('idle');
  const [isOutgoing, setIsOutgoing] = useState(false);
  const [activePeer, setActivePeer] = useState<{ username: string; displayName: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Incoming Call State
  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerUsername: string;
    callerDisplayName: string;
  } | null>(null);

  // Media Streams & Diagnostics
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [diagnostics, setDiagnostics] = useState<WebRTCDiagnostics | null>(null);

  // PWA Install prompt
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const webrtcClientRef = useRef<WebRTCClient | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>([{ urls: 'stun:stun.l.google.com:19302' }]);

  // 1. Initial auth check & Service Worker registration
  useEffect(() => {
    // Register PWA service worker
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }

    // PWA install banner listener
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    });

    const savedToken = localStorage.getItem('voipify_token');
    if (!savedToken) {
      setLoadingAuth(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${savedToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Session expired');
        return res.json();
      })
      .then((data) => {
        setToken(savedToken);
        setCurrentUser(data.user);
      })
      .catch(() => {
        localStorage.removeItem('voipify_token');
      })
      .finally(() => {
        setLoadingAuth(false);
      });
  }, []);

  // 2. Fetch ICE servers config
  const fetchIceServers = async (authToken: string) => {
    try {
      const res = await fetch('/api/ice-servers', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const data = await res.json();
      if (data.iceServers) {
        iceServersRef.current = data.iceServers;
      }
    } catch (e) {
      console.warn('Could not fetch custom ICE servers, using default STUN');
    }
  };

  // 3. Load Directory & History
  const loadDirectoryAndHistory = async (authToken: string, query = '') => {
    try {
      const [usersRes, historyRes] = await Promise.all([
        fetch(`/api/users?q=${encodeURIComponent(query)}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch('/api/calls/history', {
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      if (usersRes.ok) {
        const data = await usersRes.json();
        setRegisteredUsers(data.users || []);
      }
      if (historyRes.ok) {
        const data = await historyRes.json();
        setCallHistory(data.history || []);
      }
    } catch (err) {
      console.warn('Failed to load users or history:', err);
    }
  };

  // 4. WebSocket Signaling Connection
  useEffect(() => {
    if (!token || !currentUser) return;

    fetchIceServers(token);
    loadDirectoryAndHistory(token);

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      ws.send(JSON.stringify({ type: 'get_online_users' }));
    };

    ws.onmessage = async (event) => {
      try {
        const msg = JSON.parse(event.data);
        handleSignalingMessage(msg);
      } catch (e) {
        console.error('Signaling parse error:', e);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Closed');
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [token, currentUser]);

  // Handle incoming signaling events
  const handleSignalingMessage = async (msg: any) => {
    switch (msg.type) {
      case 'online_users_list': {
        const userSet = new Set<string>(msg.users || []);
        setOnlineUsers(userSet);
        if (msg.states) setUserStates(msg.states);
        break;
      }

      case 'presence': {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          if (msg.status === 'online') {
            next.add(msg.username);
          } else {
            next.delete(msg.username);
          }
          return next;
        });
        break;
      }

      case 'incoming_call': {
        toneGenerator?.startRingtone();
        setIncomingCall({
          callId: msg.callId,
          callerUsername: msg.callerUsername,
          callerDisplayName: msg.callerDisplayName,
        });
        break;
      }

      case 'call_ringing': {
        toneGenerator?.startRingback();
        setCallState('ringing');
        break;
      }

      case 'call_accepted': {
        toneGenerator?.stopAll();
        setCallState('in_call');

        // Caller initiates WebRTC offer
        try {
          const rtc = initializeWebRTC();
          await rtc.initializePeerConnection();
          const offer = await rtc.createOffer();
          wsRef.current?.send(
            JSON.stringify({
              type: 'offer',
              callId: msg.callId,
              sdp: offer,
            })
          );
        } catch (err: any) {
          alert(`Could not start audio stream: ${err.message}`);
          endCall();
        }
        break;
      }

      case 'call_started': {
        toneGenerator?.stopAll();
        setCallState('in_call');
        break;
      }

      case 'offer': {
        // Callee receives offer and creates answer
        try {
          const rtc = initializeWebRTC();
          await rtc.initializePeerConnection();
          const answer = await rtc.handleOffer(msg.sdp);
          wsRef.current?.send(
            JSON.stringify({
              type: 'answer',
              callId: msg.callId,
              sdp: answer,
            })
          );
        } catch (err: any) {
          alert(`Audio connection error: ${err.message}`);
          endCall();
        }
        break;
      }

      case 'answer': {
        if (webrtcClientRef.current) {
          await webrtcClientRef.current.handleAnswer(msg.sdp);
        }
        break;
      }

      case 'ice_candidate': {
        if (webrtcClientRef.current && msg.candidate) {
          await webrtcClientRef.current.addIceCandidate(msg.candidate);
        }
        break;
      }

      case 'call_rejected': {
        toneGenerator?.stopAll();
        alert(`Call was ${msg.reason || 'declined'}.`);
        cleanupCall();
        if (token) loadDirectoryAndHistory(token);
        break;
      }

      case 'call_cancelled': {
        toneGenerator?.stopAll();
        setIncomingCall(null);
        cleanupCall();
        if (token) loadDirectoryAndHistory(token);
        break;
      }

      case 'call_ended': {
        toneGenerator?.stopAll();
        toneGenerator?.playEndBeep();
        cleanupCall();
        if (token) loadDirectoryAndHistory(token);
        break;
      }

      case 'call_error': {
        toneGenerator?.stopAll();
        alert(msg.message || 'Call failed');
        cleanupCall();
        break;
      }
    }
  };

  // Helper to instantiate WebRTC Client
  const initializeWebRTC = (): WebRTCClient => {
    if (webrtcClientRef.current) {
      webrtcClientRef.current.close();
    }

    const client = new WebRTCClient({
      iceServers: iceServersRef.current,
      onRemoteStream: (stream) => {
        setRemoteStream(stream);
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = stream;
          remoteAudioRef.current.play().catch(console.warn);
        }
      },
      onIceCandidate: (candidate) => {
        if (currentCallId) {
          wsRef.current?.send(
            JSON.stringify({
              type: 'ice_candidate',
              callId: currentCallId,
              candidate,
            })
          );
        }
      },
      onConnectionStateChange: (state) => {
        console.log(`[WebRTC] Connection state: ${state}`);
        if (state === 'failed' || state === 'closed') {
          cleanupCall();
        }
      },
      onDiagnosticsUpdate: (diag) => {
        setDiagnostics(diag);
      },
    });

    webrtcClientRef.current = client;
    setLocalStream(client.getLocalStream());
    return client;
  };

  // User Actions: Outgoing Call
  const startCall = (targetUsername: string) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Signaling server disconnected. Reconnecting...');
      return;
    }

    setIsOutgoing(true);
    setActivePeer({
      username: targetUsername,
      displayName: targetUsername,
    });
    setCallState('calling');

    wsRef.current.send(
      JSON.stringify({
        type: 'call_initiate',
        targetUsername,
      })
    );
  };

  // Callee Actions: Accept Incoming Call
  const acceptCall = () => {
    if (!incomingCall || !wsRef.current) return;
    toneGenerator?.stopAll();

    setCurrentCallId(incomingCall.callId);
    setIsOutgoing(false);
    setActivePeer({
      username: incomingCall.callerUsername,
      displayName: incomingCall.callerDisplayName,
    });
    setCallState('in_call');

    wsRef.current.send(
      JSON.stringify({
        type: 'call_accept',
        callId: incomingCall.callId,
      })
    );

    setIncomingCall(null);
  };

  // Callee Actions: Reject Incoming Call
  const rejectCall = () => {
    if (!incomingCall || !wsRef.current) return;
    toneGenerator?.stopAll();

    wsRef.current.send(
      JSON.stringify({
        type: 'call_reject',
        callId: incomingCall.callId,
        reason: 'declined',
      })
    );
    setIncomingCall(null);
  };

  // In-Call: Toggle Mute
  const toggleMute = () => {
    if (webrtcClientRef.current) {
      const muted = webrtcClientRef.current.toggleMute();
      setIsMuted(muted);
    }
  };

  // In-Call: End Call
  const endCall = () => {
    toneGenerator?.stopAll();
    toneGenerator?.playEndBeep();

    if (currentCallId && wsRef.current) {
      wsRef.current.send(
        JSON.stringify({
          type: 'call_end',
          callId: currentCallId,
        })
      );
    } else if (callState === 'calling' || callState === 'ringing') {
      wsRef.current?.send(
        JSON.stringify({
          type: 'call_cancel',
          callId: currentCallId,
        })
      );
    }

    cleanupCall();
    if (token) loadDirectoryAndHistory(token);
  };

  const cleanupCall = () => {
    if (webrtcClientRef.current) {
      webrtcClientRef.current.close();
      webrtcClientRef.current = null;
    }
    setCurrentCallId(null);
    setCallState('idle');
    setActivePeer(null);
    setLocalStream(null);
    setRemoteStream(null);
    setDiagnostics(null);
    setIsMuted(false);
  };

  // Logout
  const handleLogout = () => {
    localStorage.removeItem('voipify_token');
    if (wsRef.current) wsRef.current.close();
    setToken(null);
    setCurrentUser(null);
  };

  // Trigger PWA install
  const handleInstallClick = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(() => setInstallPrompt(null));
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <PhoneCall className="h-8 w-8 text-emerald-400 animate-bounce" />
          <span className="text-sm font-medium">Starting Voipify...</span>
        </div>
      </div>
    );
  }

  if (!token || !currentUser) {
    return (
      <AuthScreen
        onAuthSuccess={(t, user) => {
          setToken(t);
          setCurrentUser(user);
        }}
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-slate-100 max-w-md mx-auto border-x border-slate-900 shadow-2xl relative">
      {/* Hidden HTML Audio element for peer stream */}
      <audio ref={remoteAudioRef} autoPlay playsInline />

      {/* Top Mobile App Bar */}
      <header className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 shadow-sm">
            <PhoneCall className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="font-bold text-sm tracking-tight text-white">Voipify</h1>
              <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full">
                PWA
              </span>
            </div>
            <p className="text-xs text-slate-400">@{currentUser.username}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {installPrompt && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Install</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-rose-400 hover:bg-slate-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Tab Screen Content */}
      <div className="flex-1 p-4 pb-20 overflow-hidden flex flex-col">
        {activeTab === 'phone' && <PhoneDialerApp />}

        {activeTab === 'directory' && (
          <DirectoryTab
            users={registeredUsers}
            onlineUsers={onlineUsers}
            userStates={userStates}
            searchQuery={searchQuery}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (token) loadDirectoryAndHistory(token, q);
            }}
            onStartCall={startCall}
            isCallingDisabled={callState !== 'idle'}
          />
        )}

        {activeTab === 'history' && (
          <CallHistoryTab
            currentUsername={currentUser.username}
            history={callHistory}
            onCallUser={startCall}
            isCallingDisabled={callState !== 'idle'}
          />
        )}

        {activeTab === 'diagnostics' && <DiagnosticsTab />}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/90 backdrop-blur-lg border-t border-slate-800 flex items-center justify-around py-2 z-20">
        <button
          onClick={() => setActiveTab('phone')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'phone'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Phone className="h-5 w-5" />
          <span className="text-[10px]">Phone</span>
        </button>

        <button
          onClick={() => setActiveTab('directory')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'directory'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="h-5 w-5" />
          <span className="text-[10px]">App Call</span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'history'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Clock className="h-5 w-5" />
          <span className="text-[10px]">Recents</span>
        </button>

        <button
          onClick={() => setActiveTab('diagnostics')}
          className={`flex flex-col items-center gap-0.5 py-1 px-3 rounded-xl transition-all ${
            activeTab === 'diagnostics'
              ? 'text-emerald-400 font-semibold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="h-5 w-5" />
          <span className="text-[10px]">Diagnostics</span>
        </button>
      </nav>

      {/* Incoming Call Overlay */}
      {incomingCall && (
        <IncomingCallModal
          callerUsername={incomingCall.callerUsername}
          callerDisplayName={incomingCall.callerDisplayName}
          onAccept={acceptCall}
          onReject={rejectCall}
        />
      )}

      {/* Active Call Overlay */}
      {callState !== 'idle' && activePeer && (
        <ActiveCallModal
          peerUsername={activePeer.username}
          peerDisplayName={activePeer.displayName}
          isOutgoing={isOutgoing}
          callState={callState}
          localStream={localStream}
          remoteStream={remoteStream}
          diagnostics={diagnostics}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onEndCall={endCall}
        />
      )}
    </main>
  );
}
