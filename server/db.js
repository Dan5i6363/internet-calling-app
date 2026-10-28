const fs = require('fs');
const path = require('path');
const { PostgresAdapter } = require('./pgAdapter');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'calling_db.json');

let pgAdapter = null;
const databaseUrl = process.env.DATABASE_URL;

if (databaseUrl && typeof databaseUrl === 'string' && databaseUrl.trim().length > 0) {
  try {
    pgAdapter = new PostgresAdapter(databaseUrl.trim());
    console.log('[DB] Configured hosted PostgreSQL adapter via DATABASE_URL');
  } catch (err) {
    console.error('[DB] Failed to initialize PostgresAdapter:', err.message);
  }
} else {
  console.log('[DB] No DATABASE_URL provided. Using local file persistence (data/calling_db.json)');
}

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading database file:', err);
  }
  return { users: {}, callHistory: [] };
}

function saveDB(db) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database:', err);
  }
}

const dbStore = {
  isPostgres() {
    return pgAdapter !== null;
  },

  getPostgresAdapter() {
    return pgAdapter;
  },

  async checkHealth() {
    if (pgAdapter) {
      const pgHealth = await pgAdapter.checkHealth();
      return {
        type: 'postgres',
        connected: pgHealth.connected,
        latencyMs: pgHealth.latencyMs,
        error: pgHealth.error,
        persistent: true,
      };
    }
    return {
      type: 'local-json',
      connected: true,
      persistent: false, // Ephemeral on container restart / cloud free tier
      filePath: DB_FILE,
      warning: 'Local JSON storage is not persistent on cloud platforms like Render free tier. Set DATABASE_URL to use hosted PostgreSQL.',
    };
  },

  getUser(username) {
    if (pgAdapter) {
      return pgAdapter.getUser(username);
    }
    if (!username) return null;
    const db = loadDB();
    return db.users[username.toLowerCase().trim()] || null;
  },

  getUserById(id) {
    if (pgAdapter) {
      return pgAdapter.getUserById(id);
    }
    if (!id) return null;
    const db = loadDB();
    for (const u of Object.values(db.users)) {
      if (u.id === id) return u;
    }
    return null;
  },

  createUser(user) {
    if (pgAdapter) {
      return pgAdapter.createUser(user);
    }
    const db = loadDB();
    const key = user.username.toLowerCase().trim();
    if (db.users[key]) {
      throw new Error('Username already exists');
    }
    const newUser = {
      id: 'usr_' + Math.random().toString(36).substring(2, 10),
      username: key,
      displayName: user.displayName || user.username,
      passwordHash: user.passwordHash,
      createdAt: new Date().toISOString(),
    };
    db.users[key] = newUser;
    saveDB(db);
    return newUser;
  },

  searchUsers(query, excludeUsername) {
    if (pgAdapter) {
      return pgAdapter.searchUsers(query, excludeUsername);
    }
    const db = loadDB();
    const q = (query || '').toLowerCase().trim();
    const results = [];

    for (const [key, user] of Object.entries(db.users)) {
      if (excludeUsername && key === excludeUsername.toLowerCase().trim()) continue;
      if (!q || key.includes(q) || (user.displayName && user.displayName.toLowerCase().includes(q))) {
        results.push({
          username: user.username,
          displayName: user.displayName,
        });
      }
    }
    return results.slice(0, 30);
  },

  addCallRecord(record) {
    if (pgAdapter) {
      return pgAdapter.addCallRecord(record);
    }
    const db = loadDB();
    const newRecord = {
      ...record,
      id: record.id || 'call_' + Math.random().toString(36).substring(2, 12),
      startedAt: record.startedAt || new Date().toISOString(),
      durationSeconds: record.durationSeconds || 0,
    };
    db.callHistory.unshift(newRecord);
    if (db.callHistory.length > 500) {
      db.callHistory = db.callHistory.slice(0, 500);
    }
    saveDB(db);
    return newRecord;
  },

  updateCallRecord(id, updates) {
    if (pgAdapter) {
      return pgAdapter.updateCallRecord(id, updates);
    }
    const db = loadDB();
    const idx = db.callHistory.findIndex(c => c.id === id);
    if (idx !== -1) {
      db.callHistory[idx] = { ...db.callHistory[idx], ...updates };
      saveDB(db);
      return db.callHistory[idx];
    }
    return null;
  },

  getCallHistory(username) {
    if (pgAdapter) {
      return pgAdapter.getCallHistory(username);
    }
    const db = loadDB();
    const u = (username || '').toLowerCase().trim();
    return db.callHistory.filter(c => c.caller.toLowerCase() === u || c.callee.toLowerCase() === u);
  }
};

module.exports = { dbStore };
