const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'calling_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
  getUser(username) {
    if (!username) return null;
    const db = loadDB();
    return db.users[username.toLowerCase().trim()] || null;
  },

  getUserById(id) {
    if (!id) return null;
    const db = loadDB();
    for (const u of Object.values(db.users)) {
      if (u.id === id) return u;
    }
    return null;
  },

  createUser(user) {
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
    const db = loadDB();
    const newRecord = {
      ...record,
      id: 'call_' + Math.random().toString(36).substring(2, 12),
    };
    db.callHistory.unshift(newRecord);
    if (db.callHistory.length > 500) {
      db.callHistory = db.callHistory.slice(0, 500);
    }
    saveDB(db);
    return newRecord;
  },

  updateCallRecord(id, updates) {
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
    const db = loadDB();
    const u = (username || '').toLowerCase().trim();
    return db.callHistory.filter(c => c.caller.toLowerCase() === u || c.callee.toLowerCase() === u);
  }
};

module.exports = { dbStore };
