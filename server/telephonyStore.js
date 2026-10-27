const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(process.cwd(), 'data');
const TELEPHONY_DB_FILE = path.join(DATA_DIR, 'telephony_db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadTelephonyDB() {
  try {
    if (fs.existsSync(TELEPHONY_DB_FILE)) {
      const data = fs.readFileSync(TELEPHONY_DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error reading telephony db:', err);
  }
  return { calls: [], favorites: [] };
}

function saveTelephonyDB(db) {
  try {
    const tempFile = `${TELEPHONY_DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(db, null, 2), 'utf8');
    fs.renameSync(tempFile, TELEPHONY_DB_FILE);
  } catch (err) {
    console.error('Error saving telephony db:', err);
  }
}

// In-memory IP rate limiter: max 10 calls per 60 seconds
const ipCallCounts = new Map();

const telephonyStore = {
  checkRateLimit(clientIp) {
    const now = Date.now();
    const windowMs = 60 * 1000;
    const maxCalls = 10;

    let records = ipCallCounts.get(clientIp) || [];
    records = records.filter(ts => now - ts < windowMs);

    if (records.length >= maxCalls) {
      return { allowed: false, retryAfterSeconds: Math.ceil((records[0] + windowMs - now) / 1000) };
    }

    records.push(now);
    ipCallCounts.set(clientIp, records);
    return { allowed: true };
  },

  addCall(record) {
    const db = loadTelephonyDB();
    const entry = {
      ...record,
      id: record.id || 'tel_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
      createdAt: new Date().toISOString(),
    };
    db.calls.unshift(entry);
    if (db.calls.length > 200) {
      db.calls = db.calls.slice(0, 200);
    }
    saveTelephonyDB(db);
    return entry;
  },

  updateCall(callId, updates) {
    const db = loadTelephonyDB();
    const idx = db.calls.findIndex(c => c.callId === callId || c.id === callId);
    if (idx !== -1) {
      db.calls[idx] = { ...db.calls[idx], ...updates };
      saveTelephonyDB(db);
      return db.calls[idx];
    }
    return null;
  },

  getRecentCalls() {
    const db = loadTelephonyDB();
    return db.calls;
  },

  getFavorites() {
    const db = loadTelephonyDB();
    return db.favorites;
  },

  addFavorite(fav) {
    const db = loadTelephonyDB();
    const exists = db.favorites.find(f => f.phoneNumber === fav.phoneNumber);
    if (exists) return exists;

    const newFav = {
      id: 'fav_' + Math.random().toString(36).substring(2, 9),
      name: fav.name || 'Contact',
      phoneNumber: fav.phoneNumber,
      countryCode: fav.countryCode || 'IN',
      dialCode: fav.dialCode || '+91',
      createdAt: new Date().toISOString(),
    };
    db.favorites.push(newFav);
    saveTelephonyDB(db);
    return newFav;
  },

  removeFavorite(id) {
    const db = loadTelephonyDB();
    db.favorites = db.favorites.filter(f => f.id !== id && f.phoneNumber !== id);
    saveTelephonyDB(db);
    return true;
  }
};

module.exports = { telephonyStore };
