'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  Grid,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Radio,
} from 'lucide-react';
import { CallProgressState } from '../../lib/telephony/types';
import { Keypad } from './Keypad';
import { dtmfAudio } from '../../lib/telephony/dtmfAudio';

interface ActiveCallScreenProps {
  targetNumber: string;
  countryFlag: string;
  countryName: string;
  callState: CallProgressState;
  isSimulated: boolean;
  onEndCall: () => void;
}

export const ActiveCallScreen: React.FC<ActiveCallScreenProps> = ({
  targetNumber,
  countryFlag,
  countryName,
  callState,
  isSimulated,
  onEndCall,
}) => {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const ringbackStopRef = useRef<(() => void) | null>(null);

  // Live duration counter
  useEffect(() => {
    let interval: any = null;
    if (callState === 'connected') {
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

  // Audio tone management during ringing
  useEffect(() => {
    if (callState === 'ringing' && dtmfAudio) {
      ringbackStopRef.current = dtmfAudio.playPSTNRingback(() => {});
    } else {
      if (ringbackStopRef.current) {
        ringbackStopRef.current();
        ringbackStopRef.current = null;
      }
    }

    return () => {
      if (ringbackStopRef.current) {
        ringbackStopRef.current();
        ringbackStopRef.current = null;
      }
    };
  }, [callState]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const getStateText = () => {
    if (isSimulated) {
      switch (callState) {
        case 'validating':
          return 'Verifying Telephony Route...';
        case 'connecting':
          return 'Simulating Dialing Sequence...';
        case 'ringing':
          return 'Simulating Ringback (Audio Test)...';
        case 'unavailable':
        case 'failed':
          return 'Outbound Blocked: ₹0 Budget (PSTN Disabled)';
        case 'ended':
          return 'Dialer Test Ended';
        default:
          return 'Simulating Route...';
      }
    }

    switch (callState) {
      case 'validating':
        return 'Verifying Route...';
      case 'connecting':
        return 'Connecting Carrier Gateway...';
      case 'ringing':
        return 'Ringing Recipient Phone...';
      case 'connected':
        return formatTimer(duration);
      case 'ended':
        return 'Call Ended';
      case 'failed':
      case 'unavailable':
        return 'Subscriber Busy / Unavailable';
      default:
        return 'Connecting...';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 p-6 md:p-8 animate-fade-in text-slate-100 max-w-md mx-auto">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isSimulated
              ? 'bg-amber-500/10 border border-amber-500/30 text-amber-400'
              : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
          }`}
        >
          {isSimulated ? (
            <ShieldAlert className="h-3.5 w-3.5" />
          ) : (
            <Radio className="h-3.5 w-3.5 animate-pulse" />
          )}
          <span>{isSimulated ? 'Simulated Route (₹0 Demo)' : 'Live Telephony Route'}</span>
        </div>

        <button
          onClick={() => setShowKeypad(!showKeypad)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors ${
            showKeypad
              ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400'
              : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
          }`}
        >
          <Grid className="h-3.5 w-3.5" />
          <span>Keypad</span>
          {showKeypad ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {/* Main Recipient Info & Visualizer */}
      <div className="flex flex-col items-center justify-center my-auto">
        <div className="relative mb-5">
          <div
            className={`w-28 h-28 rounded-full flex items-center justify-center border-4 ${
              callState === 'connected'
                ? 'border-emerald-500 shadow-xl shadow-emerald-500/20'
                : 'border-slate-800 animate-pulse'
            } bg-slate-900 text-4xl`}
          >
            {countryFlag}
          </div>
        </div>

        <h2 className="text-2xl font-bold font-mono tracking-tight text-white mb-1">
          {targetNumber}
        </h2>
        <p className="text-xs text-slate-400 mb-4">{countryName} Mobile Network</p>

        {/* Status Pill */}
        <div
          className={`px-4 py-1.5 rounded-full text-xs font-semibold tracking-wide flex items-center gap-2 ${
            callState === 'connected'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
          }`}
        >
          {callState === 'connected' && (
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          )}
          <span>{getStateText()}</span>
        </div>

        {/* Transparent Compliance & Reality Notice */}
        {isSimulated && (
          <div className="mt-5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 max-w-xs text-center text-[11px] text-amber-300 animate-fade-in">
            <p className="font-bold mb-1 flex items-center justify-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Zero-Cost Simulation Notice</span>
            </p>
            <p className="text-slate-300 leading-normal text-[11px]">
              No real telephone connection was placed. Arbitrary calling to Indian mobile numbers is blocked on ₹0 budget due to carrier termination fees and Indian DoT regulations.
            </p>
          </div>
        )}

        {/* Animated wave bars during active call */}
        {callState === 'connected' && !showKeypad && !isSimulated && (
          <div className="flex items-center justify-center gap-1.5 mt-8 h-10">
            {[40, 75, 55, 90, 60, 80, 45, 70, 50].map((h, i) => (
              <div
                key={i}
                className="w-1 bg-emerald-400 rounded-full animate-pulse"
                style={{
                  height: `${h}%`,
                  animationDelay: `${i * 120}ms`,
                  animationDuration: '900ms',
                }}
              />
            ))}
          </div>
        )}

        {/* In-Call Keypad (for IVR Touch-Tone navigation) */}
        {showKeypad && (
          <div className="mt-6 w-full max-w-[260px] animate-fade-in">
            <Keypad
              onDigitPress={(digit) => {
                // Audio tone already handled in Keypad
              }}
              onBackspace={() => {}}
              onClear={() => {}}
            />
          </div>
        )}
      </div>

      {/* Call Actions */}
      <div className="flex items-center justify-center gap-7 pb-4">
        {/* Mute */}
        <button
          onClick={() => setIsMuted(!isMuted)}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          className={`flex h-14 w-14 items-center justify-center rounded-full transition-all active:scale-95 ${
            isMuted
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/50'
              : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
          }`}
        >
          {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
        </button>

        {/* Hang Up (Red) */}
        <button
          onClick={onEndCall}
          aria-label="Hang up call"
          className="flex h-18 w-18 items-center justify-center rounded-full bg-rose-600 hover:bg-rose-500 text-white shadow-xl shadow-rose-600/30 transition-all active:scale-90 p-4"
        >
          <PhoneOff className="h-8 w-8" />
        </button>

        {/* Speaker / Device Toggle */}
        <button
          onClick={() => alert('Audio routed to communication device.')}
          aria-label="Speakerphone"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800 active:scale-95"
        >
          <Volume2 className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
