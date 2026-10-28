const { Pool } = require('pg');

class PostgresAdapter {
  constructor(connectionString) {
    this.connectionString = connectionString;
    const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    this.pool = new Pool({
      connectionString,
      ssl: isLocalhost ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    this.pool.on('error', (err) => {
      console.error('[PostgresPool] Unexpected idle client error:', err.message);
    });

    this.initialized = false;
    this.initPromise = null;
  }

  async initSchema() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`
          CREATE TABLE IF NOT EXISTS users (
            id VARCHAR(64) PRIMARY KEY,
            username VARCHAR(32) UNIQUE NOT NULL,
            display_name VARCHAR(64) NOT NULL,
            password_hash VARCHAR(128) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS app_call_records (
            id VARCHAR(64) PRIMARY KEY,
            caller VARCHAR(32) NOT NULL,
            callee VARCHAR(32) NOT NULL,
            status VARCHAR(24) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL,
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE INDEX IF NOT EXISTS idx_call_caller ON app_call_records(caller);
          CREATE INDEX IF NOT EXISTS idx_call_callee ON app_call_records(callee);

          CREATE TABLE IF NOT EXISTS telephony_calls (
            id VARCHAR(64) PRIMARY KEY,
            call_id VARCHAR(64) NOT NULL,
            target_number VARCHAR(32) NOT NULL,
            country_code VARCHAR(8) NOT NULL,
            provider_name VARCHAR(64) NOT NULL,
            is_simulated BOOLEAN DEFAULT TRUE,
            state VARCHAR(24) NOT NULL,
            started_at TIMESTAMP WITH TIME ZONE NOT NULL,
            ended_at TIMESTAMP WITH TIME ZONE,
            duration_seconds INTEGER DEFAULT 0,
            end_reason TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS telephony_favorites (
            id VARCHAR(64) PRIMARY KEY,
            name VARCHAR(64) NOT NULL,
            phone_number VARCHAR(32) NOT NULL,
            country_code VARCHAR(8) NOT NULL,
            dial_code VARCHAR(8) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        await client.query('COMMIT');
        this.initialized = true;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        this.initPromise = null;
        throw err;
      } finally {
        client.release();
      }
    })();

    return this.initPromise;
  }

  async checkHealth() {
    try {
      const start = Date.now();
      const res = await this.pool.query('SELECT 1');
      return { connected: res.rowCount === 1, latencyMs: Date.now() - start };
    } catch (err) {
      return { connected: false, error: err.message };
    }
  }

  async transaction(callback) {
    await this.initSchema();
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  async getUser(username) {
    if (!username) return null;
    await this.initSchema();
    const res = await this.pool.query(
      'SELECT id, username, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE LOWER(username) = LOWER($1)',
      [username.trim()]
    );
    return res.rows[0] || null;
  }

  async getUserById(id) {
    if (!id) return null;
    await this.initSchema();
    const res = await this.pool.query(
      'SELECT id, username, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt" FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }

  async createUser(user) {
    await this.initSchema();
    const key = user.username.toLowerCase().trim();
    const id = 'usr_' + Math.random().toString(36).substring(2, 10);
    const displayName = user.displayName || user.username;
    const createdAt = new Date().toISOString();

    try {
      const res = await this.pool.query(
        'INSERT INTO users (id, username, display_name, password_hash, created_at) VALUES ($1, $2, $3, $4, $5) RETURNING id, username, display_name AS "displayName", password_hash AS "passwordHash", created_at AS "createdAt"',
        [id, key, displayName, user.passwordHash, createdAt]
      );
      return res.rows[0];
    } catch (err) {
      if (err.code === '23505') {
        throw new Error('Username already exists');
      }
      throw err;
    }
  }

  async searchUsers(query, excludeUsername) {
    await this.initSchema();
    const q = `%${(query || '').toLowerCase().trim()}%`;
    const exclude = (excludeUsername || '').toLowerCase().trim();

    const res = await this.pool.query(
      `SELECT username, display_name AS "displayName"
       FROM users
       WHERE LOWER(username) != LOWER($1)
         AND (LOWER(username) LIKE $2 OR LOWER(display_name) LIKE $2)
       ORDER BY username ASC
       LIMIT 30`,
      [exclude, q]
    );
    return res.rows;
  }

  async addCallRecord(record) {
    await this.initSchema();
    const id = record.id || 'call_' + Math.random().toString(36).substring(2, 12);
    const startedAt = record.startedAt || new Date().toISOString();
    const endedAt = record.endedAt || null;
    const durationSeconds = record.durationSeconds || 0;

    const res = await this.pool.query(
      `INSERT INTO app_call_records (id, caller, callee, status, started_at, ended_at, duration_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, caller, callee, status, started_at AS "startedAt", ended_at AS "endedAt", duration_seconds AS "durationSeconds"`,
      [id, record.caller, record.callee, record.status, startedAt, endedAt, durationSeconds]
    );
    return res.rows[0];
  }

  async updateCallRecord(id, updates) {
    await this.initSchema();
    const setClauses = [];
    const values = [id];
    let idx = 2;

    if (updates.status !== undefined) {
      setClauses.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.endedAt !== undefined) {
      setClauses.push(`ended_at = $${idx++}`);
      values.push(updates.endedAt);
    }
    if (updates.durationSeconds !== undefined) {
      setClauses.push(`duration_seconds = $${idx++}`);
      values.push(updates.durationSeconds);
    }

    if (setClauses.length === 0) return null;

    const res = await this.pool.query(
      `UPDATE app_call_records SET ${setClauses.join(', ')} WHERE id = $1 RETURNING id, caller, callee, status, started_at AS "startedAt", ended_at AS "endedAt", duration_seconds AS "durationSeconds"`,
      values
    );
    return res.rows[0] || null;
  }

  async getCallHistory(username) {
    await this.initSchema();
    const u = (username || '').toLowerCase().trim();
    const res = await this.pool.query(
      `SELECT id, caller, callee, status, started_at AS "startedAt", ended_at AS "endedAt", duration_seconds AS "durationSeconds"
       FROM app_call_records
       WHERE LOWER(caller) = LOWER($1) OR LOWER(callee) = LOWER($1)
       ORDER BY started_at DESC
       LIMIT 100`,
      [u]
    );
    return res.rows;
  }

  async addTelephonyCall(call) {
    await this.initSchema();
    const id = call.id || 'tel_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    const startedAt = call.startedAt || new Date().toISOString();
    const endedAt = call.endedAt || null;

    const res = await this.pool.query(
      `INSERT INTO telephony_calls (id, call_id, target_number, country_code, provider_name, is_simulated, state, started_at, ended_at, duration_seconds, end_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, call_id AS "callId", target_number AS "targetNumber", country_code AS "countryCode", provider_name AS "providerName", is_simulated AS "isSimulated", state, started_at AS "startedAt", duration_seconds AS "durationSeconds"`,
      [
        id,
        call.callId || id,
        call.targetNumber,
        call.countryCode,
        call.providerName,
        call.isSimulated !== false,
        call.state,
        startedAt,
        endedAt,
        call.durationSeconds || 0,
        call.endReason || null,
      ]
    );
    return res.rows[0];
  }

  async updateTelephonyCall(callId, updates) {
    await this.initSchema();
    const setClauses = [];
    const values = [callId];
    let idx = 2;

    if (updates.state !== undefined) {
      setClauses.push(`state = $${idx++}`);
      values.push(updates.state);
    }
    if (updates.durationSeconds !== undefined) {
      setClauses.push(`duration_seconds = $${idx++}`);
      values.push(updates.durationSeconds);
    }
    if (updates.endedAt !== undefined) {
      setClauses.push(`ended_at = $${idx++}`);
      values.push(updates.endedAt);
    }
    if (updates.endReason !== undefined) {
      setClauses.push(`end_reason = $${idx++}`);
      values.push(updates.endReason);
    }

    if (setClauses.length === 0) return null;

    const res = await this.pool.query(
      `UPDATE telephony_calls SET ${setClauses.join(', ')} WHERE call_id = $1 OR id = $1 RETURNING id, call_id AS "callId", state, duration_seconds AS "durationSeconds"`,
      values
    );
    return res.rows[0] || null;
  }

  async getRecentTelephonyCalls() {
    await this.initSchema();
    const res = await this.pool.query(
      `SELECT id, call_id AS "callId", target_number AS "targetNumber", country_code AS "countryCode", provider_name AS "providerName", is_simulated AS "isSimulated", state, started_at AS "startedAt", duration_seconds AS "durationSeconds"
       FROM telephony_calls
       ORDER BY started_at DESC
       LIMIT 100`
    );
    return res.rows;
  }

  async getFavorites() {
    await this.initSchema();
    const res = await this.pool.query(
      `SELECT id, name, phone_number AS "phoneNumber", country_code AS "countryCode", dial_code AS "dialCode"
       FROM telephony_favorites
       ORDER BY created_at DESC`
    );
    return res.rows;
  }

  async addFavorite(fav) {
    await this.initSchema();
    const id = 'fav_' + Math.random().toString(36).substring(2, 9);
    const res = await this.pool.query(
      `INSERT INTO telephony_favorites (id, name, phone_number, country_code, dial_code)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, phone_number AS "phoneNumber", country_code AS "countryCode", dial_code AS "dialCode"`,
      [id, fav.name || 'Contact', fav.phoneNumber, fav.countryCode || 'IN', fav.dialCode || '+91']
    );
    return res.rows[0];
  }

  async removeFavorite(id) {
    await this.initSchema();
    await this.pool.query(
      `DELETE FROM telephony_favorites WHERE id = $1 OR phone_number = $1`,
      [id]
    );
    return true;
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = { PostgresAdapter };
