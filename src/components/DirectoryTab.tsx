'use client';

import React, { useState } from 'react';
import { Search, Phone, User, Signal } from 'lucide-react';

interface DirectoryUser {
  username: string;
  displayName: string;
}

interface DirectoryTabProps {
  users: DirectoryUser[];
  onlineUsers: Set<string>;
  userStates: Record<string, string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onStartCall: (targetUsername: string) => void;
  isCallingDisabled: boolean;
}

export const DirectoryTab: React.FC<DirectoryTabProps> = ({
  users,
  onlineUsers,
  userStates,
  searchQuery,
  onSearchChange,
  onStartCall,
  isCallingDisabled,
}) => {
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search usernames or contacts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
        />
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {users.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            {searchQuery ? 'No registered users match your search' : 'No other users registered yet'}
          </div>
        ) : (
          users.map((u) => {
            const isOnline = onlineUsers.has(u.username);
            const state = userStates[u.username] || 'idle';
            const isBusy = state !== 'idle';

            return (
              <div
                key={u.username}
                className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 hover:bg-slate-800/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-semibold text-sm">
                      {u.displayName.charAt(0).toUpperCase()}
                    </div>
                    {/* Presence Dot */}
                    <span
                      className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-slate-900 ${
                        isOnline
                          ? isBusy
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                          : 'bg-slate-600'
                      }`}
                      title={isOnline ? (isBusy ? 'Busy' : 'Online') : 'Offline'}
                    />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white">{u.displayName}</h4>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <span>@{u.username}</span>
                      <span>•</span>
                      <span
                        className={
                          isOnline
                            ? isBusy
                              ? 'text-amber-400 font-medium'
                              : 'text-emerald-400 font-medium'
                            : 'text-slate-500'
                        }
                      >
                        {isOnline ? (isBusy ? 'On Call' : 'Available') : 'Offline'}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  disabled={isCallingDisabled || !isOnline || isBusy}
                  onClick={() => onStartCall(u.username)}
                  aria-label={`Call ${u.displayName}`}
                  className={`flex items-center justify-center h-10 w-10 rounded-full transition-all ${
                    !isOnline || isBusy || isCallingDisabled
                      ? 'bg-slate-800 text-slate-600 cursor-not-allowed'
                      : 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95'
                  }`}
                  title={
                    !isOnline
                      ? 'User is offline'
                      : isBusy
                      ? 'User is busy'
                      : 'Free Internet Audio Call'
                  }
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
