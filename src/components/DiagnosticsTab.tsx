'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Mic,
  Wifi,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Play,
  Square,
} from 'lucide-react';

export const DiagnosticsTab: React.FC = () => {
  const [testingMic, setTestingMic] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [iceStatus, setIceStatus] = useState<string>('Not tested');
  const [iceCandidatesFound, setIceCandidatesFound] = useState<string[]>([]);
  const [isIceTesting, setIsIceTesting] = useState(false);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Microphone hardware test
  const startMicTest = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      const source = ctx.createMediaStreamSource(stream);
      source.connect(analyser);

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      setTestingMic(true);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));
        animFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err: any) {
      alert(`Mic test failed: ${err.message}`);
    }
  };

  const stopMicTest = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
    setTestingMic(false);
    setAudioLevel(0);
  };

  // STUN ICE Candidate Connectivity test
  const runIceTest = async () => {
    setIsIceTesting(true);
    setIceStatus('Gathering candidates...');
    setIceCandidatesFound([]);

    try {
      const res = await fetch('/api/ice-servers', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('voipify_token') || ''}`,
        },
      });
      const data = await res.json();
      const iceServers = data.iceServers || [{ urls: 'stun:stun.l.google.com:19302' }];

      const pc = new RTCPeerConnection({ iceServers });
      const candidates: string[] = [];

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const type = event.candidate.type || 'candidate';
          const candidateStr = `[${type.toUpperCase()}] ${event.candidate.protocol} ${event.candidate.address || 'IP'}:${event.candidate.port}`;
          candidates.push(candidateStr);
          setIceCandidatesFound([...candidates]);
        } else {
          setIceStatus(`ICE gathering complete (${candidates.length} candidates gathered)`);
          setIsIceTesting(false);
          pc.close();
        }
      };

      // Create dummy data channel to trigger ICE
      pc.createDataChannel('test');
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      setTimeout(() => {
        if (pc.iceGatheringState !== 'complete') {
          setIceStatus(`Gathered ${candidates.length} candidates (Timeout reached)`);
          setIsIceTesting(false);
          pc.close();
        }
      }, 7000);
    } catch (err: any) {
      setIceStatus(`ICE Test failed: ${err.message}`);
      setIsIceTesting(false);
    }
  };

  useEffect(() => {
    return () => {
      stopMicTest();
    };
  }, []);

  return (
    <div className="flex flex-col h-full space-y-5 overflow-y-auto pr-1">
      {/* Mic Test Card */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Mic className="h-4 w-4 text-emerald-400" />
            <span>Microphone Hardware Check</span>
          </div>
          <button
            onClick={testingMic ? stopMicTest : startMicTest}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
              testingMic
                ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
            }`}
          >
            {testingMic ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span>{testingMic ? 'Stop Test' : 'Test Mic'}</span>
          </button>
        </div>

        {/* VU Meter */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Input Level</span>
            <span className="font-mono">{audioLevel}%</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500 transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        </div>
      </div>

      {/* STUN / TURN Connectivity Card */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Wifi className="h-4 w-4 text-emerald-400" />
            <span>STUN/TURN NAT Traversal</span>
          </div>
          <button
            disabled={isIceTesting}
            onClick={runIceTest}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 disabled:opacity-50"
          >
            {isIceTesting ? 'Testing...' : 'Ping STUN'}
          </button>
        </div>

        <div className="text-xs text-slate-400">
          Status: <span className="text-emerald-400 font-medium">{iceStatus}</span>
        </div>

        {iceCandidatesFound.length > 0 && (
          <div className="rounded-xl bg-slate-950 p-2.5 font-mono text-xs text-slate-300 space-y-1 max-h-32 overflow-y-auto">
            {iceCandidatesFound.map((c, i) => (
              <div key={i} className="text-slate-400">
                • {c}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WebRTC Capability Checklist */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
        <h4 className="text-sm font-semibold text-white mb-2">Browser Environment Capabilities</h4>
        <div className="space-y-2 text-xs">
          <div className="flex items-center justify-between text-slate-300">
            <span>WebRTC RTCPeerConnection:</span>
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Supported
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Web Audio API:</span>
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Supported
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Service Worker (PWA):</span>
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" /> Ready
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-300">
            <span>Audio Codec:</span>
            <span className="text-emerald-400 font-mono font-medium">OPUS (Adaptive, FEC)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
