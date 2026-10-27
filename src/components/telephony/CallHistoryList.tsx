'use client';

import React from 'react';
import { PhoneOutgoing, PhoneOff, Phone, Star, Clock } from 'lucide-react';
import { COUNTRIES } from '@/lib/telephony/phoneUtils';

interface CallRecord {
  id: string;
  targetNumber: string;
  countryCode: string;
  providerName: string;
  isSimulated: boolean;
  state: string;
  startedAt: string;
  durationSeconds: number;
}

interface CallHistoryListProps {
  calls: CallRecord[];
  onDialNumber: (num: string, countryCode: string) => void;
  onAddFavorite: (num: string, countryCode: string) => void;
}

export const CallHistoryList: React.FC<CallHistoryListProps> = ({
  calls,
  onDialNumber,
  onAddFavorite,
}) => {
  const formatDuration = (secs: number) => {
    if (!secs) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return (
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
        ', ' +
        d.toLocaleDateString([], { month: 'short', day: 'numeric' })
      );
    } catch {
      return iso;
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-400 px-1">
        <span>Recent Telephone Calls</span>
        <span>{calls.length} total</span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {calls.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No telephone call history yet. Enter a number to call!
          </div>
        ) : (
          calls.map((c) => {
            const country = COUNTRIES.find((x) => x.code === c.countryCode) || COUNTRIES[0];
            const isCompleted = c.durationSeconds > 0;

            return (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/40 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                    {country.flag}
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold font-mono text-white">
                      {c.targetNumber}
                    </h4>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <span>{country.name}</span>
                      <span>•</span>
                      <span className={isCompleted ? 'text-emerald-400 font-mono' : 'text-slate-500'}>
                        {isCompleted ? formatDuration(c.durationSeconds) : 'No Answer'}
                      </span>
                      <span>•</span>
                      <span className="text-slate-500">{formatDate(c.startedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onAddFavorite(c.targetNumber, c.countryCode)}
                    title="Add to Favorites"
                    className="p-2 rounded-full text-slate-500 hover:text-amber-400 hover:bg-slate-800 transition-colors"
                  >
                    <Star className="h-4 w-4" />
                  </button>

                  <button
                    onClick={() => onDialNumber(c.targetNumber, c.countryCode)}
                    title="Call Back"
                    className="p-2 rounded-full bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
