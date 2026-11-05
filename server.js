const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shivansh123';
const DATABASE_URL =
  process.env.DATABASE_URL ||
  'postgresql://neondb_owner:npg_I0daJLCTt5Bj@ep-rough-night-bd4n8tz5-pooler.c-8.us-east-2.aws.neon.tech/neondb?sslmode=require';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// PostgreSQL connection pool (Neon DB)
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Auto-initialize DB Table
async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS activation_keys (
        key VARCHAR(100) PRIMARY KEY,
        is_used BOOLEAN DEFAULT FALSE,
        device_id VARCHAR(255),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        used_at TIMESTAMPTZ,
        note TEXT
      );
    `);
    console.log('✅ Connected to Neon PostgreSQL & verified activation_keys table.');
  } catch (err) {
    console.error('❌ Neon PostgreSQL initialization error:', err.message);
  }
}
initDb();

// ----------------------
// 1. MOBILE APP ACTIVATION ENDPOINT
// ----------------------
app.post('/api/activate', async (req, res) => {
  const { key, deviceId } = req.body;

  if (!key || !deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Activation key and Device ID are required.',
    });
  }

  const cleanKey = key.trim().toUpperCase();

  try {
    const result = await pool.query('SELECT * FROM activation_keys WHERE key = $1', [cleanKey]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Invalid activation key. Please check spelling or contact admin.',
      });
    }

    const row = result.rows[0];

    // If key is already used
    if (row.is_used) {
      // If used on the same device, allow re-activation (restore license)
      if (row.device_id === deviceId) {
        return res.json({
          success: true,
          message: 'Device license verified and restored.',
          key: cleanKey,
          activatedAt: row.used_at,
        });
      }

      return res.status(403).json({
        success: false,
        error: 'This key has already been activated on another device and cannot be reused.',
      });
    }

    // Mark key as used & bind deviceId
    const now = new Date().toISOString();
    await pool.query(
      'UPDATE activation_keys SET is_used = TRUE, device_id = $1, used_at = $2 WHERE key = $3',
      [deviceId, now, cleanKey]
    );

    return res.json({
      success: true,
      message: 'App activated successfully! Welcome to PW Pro.',
      key: cleanKey,
      activatedAt: now,
    });
  } catch (err) {
    console.error('Activation DB error:', err);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while activating key.',
    });
  }
});

// ----------------------
// 2. ADMIN AUTH MIDDLEWARE
// ----------------------
function checkAdminAuth(req, res, next) {
  const authHeader = req.headers['x-admin-password'] || req.query.adminPassword;
  if (!authHeader || authHeader !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized: Incorrect admin password.' });
  }
  next();
}

// ----------------------
// 3. ADMIN PANEL API ENDPOINTS
// ----------------------

// Get all keys & stats
app.get('/api/admin/keys', checkAdminAuth, async (req, res) => {
  try {
    const keysResult = await pool.query(
      'SELECT key, is_used AS "isUsed", device_id AS "deviceId", created_at AS "createdAt", used_at AS "usedAt", note FROM activation_keys ORDER BY created_at DESC'
    );
    const keys = keysResult.rows;

    const total = keys.length;
    const used = keys.filter((k) => k.isUsed).length;
    const available = total - used;

    res.json({
      stats: { total, used, available },
      keys,
    });
  } catch (err) {
    console.error('Fetch keys error:', err);
    res.status(500).json({ error: 'Failed to retrieve keys from database.' });
  }
});

// Add or Generate Keys
app.post('/api/admin/keys', checkAdminAuth, async (req, res) => {
  const { customKey, count = 1, prefix = 'PWPRO', note = '' } = req.body;
  const createdKeys = [];

  try {
    if (customKey && customKey.trim()) {
      const formatted = customKey.trim().toUpperCase();

      const exists = await pool.query('SELECT key FROM activation_keys WHERE key = $1', [formatted]);
      if (exists.rows.length > 0) {
        return res.status(400).json({ error: `Key "${formatted}" already exists.` });
      }

      const insertRes = await pool.query(
        'INSERT INTO activation_keys (key, is_used, note) VALUES ($1, FALSE, $2) RETURNING key, is_used AS "isUsed", created_at AS "createdAt", note',
        [formatted, note || 'Custom Admin Key']
      );
      createdKeys.push(insertRes.rows[0]);
    } else {
      const numToGen = Math.min(Math.max(parseInt(count) || 1, 1), 50);

      for (let i = 0; i < numToGen; i++) {
        const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
        const generated = `${prefix.trim().toUpperCase()}-${part1}-${part2}`;

        try {
          const insertRes = await pool.query(
            'INSERT INTO activation_keys (key, is_used, note) VALUES ($1, FALSE, $2) RETURNING key, is_used AS "isUsed", created_at AS "createdAt", note',
            [generated, note || 'Auto-generated']
          );
          createdKeys.push(insertRes.rows[0]);
        } catch (e) {
          // ignore unique constraint collisions on random string
        }
      }
    }

    res.json({
      success: true,
      message: `Generated ${createdKeys.length} new key(s).`,
      created: createdKeys,
    });
  } catch (err) {
    console.error('Insert keys error:', err);
    res.status(500).json({ error: 'Failed to generate keys in database.' });
  }
});

// Delete or Revoke Key
app.delete('/api/admin/keys/:key', checkAdminAuth, async (req, res) => {
  const targetKey = req.params.key.trim().toUpperCase();

  try {
    const deleteRes = await pool.query('DELETE FROM activation_keys WHERE key = $1', [targetKey]);

    if (deleteRes.rowCount === 0) {
      return res.status(404).json({ error: 'Key not found.' });
    }

    res.json({ success: true, message: `Key ${targetKey} deleted.` });
  } catch (err) {
    console.error('Delete key error:', err);
    res.status(500).json({ error: 'Failed to delete key.' });
  }
});

// Reset key (unbind device to allow re-use)
app.post('/api/admin/keys/reset', checkAdminAuth, async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });

  const targetKey = key.trim().toUpperCase();

  try {
    const updateRes = await pool.query(
      'UPDATE activation_keys SET is_used = FALSE, device_id = NULL, used_at = NULL WHERE key = $1',
      [targetKey]
    );

    if (updateRes.rowCount === 0) {
      return res.status(404).json({ error: 'Key not found.' });
    }

    res.json({ success: true, message: `Key ${targetKey} has been reset to unused.` });
  } catch (err) {
    console.error('Reset key error:', err);
    res.status(500).json({ error: 'Failed to reset key.' });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW()');
    res.json({ status: 'ok', time: dbTest.rows[0].now, db: 'Neon PostgreSQL connected' });
  } catch (e) {
    res.status(500).json({ status: 'error', message: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 PW Pro Admin Server running on port ${PORT}`);
  console.log(`🔑 Web Admin Panel: http://localhost:${PORT}`);
  console.log(`🗄️  Connected to Neon PostgreSQL Database`);
  console.log(`🛡️  Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`===========================================\n`);
});
