'use client';

import React, { useState, useEffect } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Activity,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { WebRTCDiagnostics } from '@/lib/webrtcClient';
import { AudioVisualizer } from './AudioVisualizer';

interface ActiveCallModalProps {
  peerUsername: string;
  peerDisplayName?: string;
  isOutgoing: boolean;
  callState: 'calling' | 'ringing' | 'in_call';
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  diagnostics: WebRTCDiagnostics | null;
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}

export const ActiveCallModal: React.FC<ActiveCallModalProps> = ({
  peerUsername,
  peerDisplayName,
  isOutgoing,
  callState,
  localStream,
  remoteStream,
  diagnostics,
  isMuted,
  onToggleMute,
  onEndCall,
}) => {
  const [duration, setDuration] = useState(0);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  useEffect(() => {
    let interval: any = null;
    if (callState === 'in_call') {
      interval = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [callState]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStatusText = () => {
    if (callState === 'calling') return 'Connecting...';
    if (callState === 'ringing') return isOutgoing ? 'Ringing...' : 'Incoming...';
    return formatTime(duration);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 p-6 md:p-10 animate-fade-in text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900 border border-slate-800 text-xs font-medium text-emerald-400">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Encrypted WebRTC P2P</span>
        </div>

        <button
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            showDiagnostics
              ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Activity className="h-3.5 w-3.5" />
          <span>Diagnostics</span>
          {showDiagnostics ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Main Peer Info & Visualizer */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="relative mb-6">
          <div
            className={`w-32 h-32 md:w-36 md:h-36 rounded-full flex items-center justify-center border-4 ${
              callState === 'in_call'
                ? 'border-emerald-500 shadow-xl shadow-emerald-500/20'
                : 'border-slate-700 animate-pulse'
            } bg-slate-900`}
          >
            <User className="w-16 h-16 text-slate-400" />
          </div>
        </div>

        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-1">
          {peerDisplayName || peerUsername}
        </h2>
        <p className="text-sm font-medium text-slate-400 mb-4">@{peerUsername}</p>

        {/* Status Pill */}
        <div
          className={`px-4 py-1.5 rounded-full text-sm font-semibold tracking-wide flex items-center gap-2 ${
            callState === 'in_call'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
          }`}
        >
          {callState === 'in_call' && <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />}
          <span>{getStatusText()}</span>
        </div>

        {/* Real-time Audio Waveform Visualizer */}
        <div className="mt-8 w-full max-w-xs">
          <AudioVisualizer
            stream={remoteStream || localStream}
            isActive={callState === 'in_call'}
            color={callState === 'in_call' ? '#10b981' : '#64748b'}
          />
        </div>
      </div>

      {/* Diagnostics Drawer (Collapsible) */}
      {showDiagnostics && (
        <div className="mb-6 rounded-2xl bg-slate-900/90 border border-slate-800 p-4 text-xs font-mono backdrop-blur-md">
          <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-800">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Wifi className="h-3.5 w-3.5 text-emerald-400" /> Connection Telemetry
            </span>
            <span className="text-slate-500">RFC 8835 / getStats</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-slate-300">
            <div>
              <span className="text-slate-500 block">State:</span>
              <span className="font-semibold text-emerald-400">
                {diagnostics?.connectionState || 'connecting'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Round-Trip Time:</span>
              <span className="font-semibold">
                {diagnostics?.rttMs !== null && diagnostics?.rttMs !== undefined
                  ? `${diagnostics.rttMs} ms`
                  : 'calculating...'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Jitter / Loss:</span>
              <span className="font-semibold">
                {diagnostics?.jitterMs !== null ? `${diagnostics?.jitterMs} ms` : '0 ms'} / {diagnostics?.packetLossPercent || 0}%
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Bitrate:</span>
              <span className="font-semibold">{diagnostics?.bitrateKbps || 0} kbps</span>
            </div>
            <div>
              <span className="text-slate-500 block">Codec:</span>
              <span className="font-semibold">{diagnostics?.codec || 'OPUS (48kHz)'}</span>
            </div>
            <div>
              <span className="text-slate-500 block">ICE Path:</span>
              <span className="font-semibold text-amber-400">
                {diagnostics?.localCandidateType || 'host'} ➔ {diagnostics?.remoteCandidateType || 'peer'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Call Action Bar */}
      <div className="flex items-center justify-center gap-8 pb-4">
        {/* Mute Button */}
        <button
          onClick={onToggleMute}
          aria-label={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
          className={`flex h-16 w-16 items-center justify-center rounded-full transition-all active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
              : 'bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700'
          }`}
        >
          {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
        </button>

        {/* End Call Button */}
        <button
          onClick={onEndCall}
          aria-label="Hang up call"
          className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-xl shadow-rose-600/30 transition-all hover:bg-rose-500 active:scale-90"
        >
          <PhoneOff className="h-9 w-9" />
        </button>

        {/* Speaker / Device Indicator */}
        <button
          aria-label="Speakerphone active"
          className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 active:scale-95"
          onClick={() => {
            alert('Audio routed to default communication device / earpiece.');
          }}
        >
          <Volume2 className="h-6 w-6" />
        </button>
      </div>
    </div>
  );
};
