'use client';

import React from 'react';
import { Phone, PhoneOff, User } from 'lucide-react';

interface IncomingCallModalProps {
  callerUsername: string;
  callerDisplayName: string;
  onAccept: () => void;
  onReject: () => void;
}

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callerUsername,
  callerDisplayName,
  onAccept,
  onReject,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-8 text-center shadow-2xl">
        {/* Pulsing Avatar */}
        <div className="relative mx-auto mb-6 flex h-28 w-28 items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ring-pulse" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-slate-800 border-2 border-emerald-500 text-emerald-400">
            <User className="h-12 w-12" />
          </div>
        </div>

        <h3 className="text-2xl font-bold text-white mb-1">
          {callerDisplayName || callerUsername}
        </h3>
        <p className="text-sm font-medium text-emerald-400 mb-2">@{callerUsername}</p>
        <p className="text-xs text-slate-400 mb-8 uppercase tracking-wider font-semibold">
          Incoming Internet Audio Call
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-around gap-6">
          <button
            onClick={onReject}
            aria-label="Decline Call"
            className="group flex flex-col items-center gap-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition-all active:scale-90 group-hover:bg-rose-500">
              <PhoneOff className="h-7 w-7" />
            </div>
            <span className="text-xs font-medium text-slate-400">Decline</span>
          </button>

          <button
            onClick={onAccept}
            aria-label="Accept Call"
            className="group flex flex-col items-center gap-2"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition-all active:scale-90 group-hover:bg-emerald-400 animate-bounce">
              <Phone className="h-7 w-7" />
            </div>
            <span className="text-xs font-medium text-emerald-400 font-semibold">Accept</span>
          </button>
        </div>
      </div>
    </div>
  );
};
