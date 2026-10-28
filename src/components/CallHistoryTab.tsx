'use client';

import React from 'react';
import {
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  PhoneOff,
  Phone,
  Clock,
} from 'lucide-react';
import { CallRecord } from '../lib/db';

interface CallHistoryTabProps {
  currentUsername: string;
  history: CallRecord[];
  onCallUser: (username: string) => void;
  isCallingDisabled: boolean;
}

export const CallHistoryTab: React.FC<CallHistoryTabProps> = ({
  currentUsername,
  history,
  onCallUser,
  isCallingDisabled,
}) => {
  const formatDuration = (secs: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ', ' + d.toLocaleDateString([], { month: 'short', day: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
        <span>Recent Calls</span>
        <span>{history.length} total</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {history.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-40" />
            No call history yet. Start your first audio call!
          </div>
        ) : (
          history.map((call) => {
            const isCaller = call.caller.toLowerCase() === currentUsername.toLowerCase();
            const peer = isCaller ? call.callee : call.caller;

            let icon = <PhoneOutgoing className="h-4 w-4 text-emerald-400" />;
            let statusLabel = 'Outgoing Call';
            let statusColor = 'text-slate-400';

            if (!isCaller) {
              if (call.status === 'completed') {
                icon = <PhoneIncoming className="h-4 w-4 text-emerald-400" />;
                statusLabel = 'Incoming Call';
              } else {
                icon = <PhoneMissed className="h-4 w-4 text-rose-400" />;
                statusLabel = 'Missed Call';
                statusColor = 'text-rose-400';
              }
            } else {
              if (call.status === 'missed') {
                icon = <PhoneOff className="h-4 w-4 text-slate-400" />;
                statusLabel = 'Unanswered';
              } else if (call.status === 'rejected') {
                icon = <PhoneOff className="h-4 w-4 text-rose-400" />;
                statusLabel = 'Declined';
                statusColor = 'text-rose-400';
              } else if (call.status === 'busy') {
                icon = <PhoneOff className="h-4 w-4 text-amber-400" />;
                statusLabel = 'Busy';
                statusColor = 'text-amber-400';
              }
            }

            return (
              <div
                key={call.id}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    {icon}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white">@{peer}</h4>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={statusColor}>{statusLabel}</span>
                      {call.durationSeconds > 0 && (
                        <>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-300 font-mono">{formatDuration(call.durationSeconds)}</span>
                        </>
                      )}
                      <span className="text-slate-600">•</span>
                      <span className="text-slate-500">{formatDate(call.startedAt)}</span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={isCallingDisabled}
                  onClick={() => onCallUser(peer)}
                  aria-label={`Call back ${peer}`}
                  className="flex items-center justify-center h-9 w-9 rounded-full bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
