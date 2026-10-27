// Shared db export for Next.js App Router
const { dbStore } = require('../../server/db.js');

export interface User {
  id: string;
  username: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface CallRecord {
  id: string;
  caller: string;
  callee: string;
  status: 'completed' | 'missed' | 'rejected' | 'busy' | 'failed';
  startedAt: string;
  endedAt?: string;
  durationSeconds: number;
}

export { dbStore };
