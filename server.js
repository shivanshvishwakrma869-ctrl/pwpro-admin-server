const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'shivansh123';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Database file storage
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'keys.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadKeys() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content || '[]');
    }
  } catch (e) {
    console.error('Error loading keys database:', e);
  }
  return [];
}

function saveKeys(keys) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(keys, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving keys database:', e);
  }
}

// Ensure default demo key exists if empty
let dbKeys = loadKeys();
if (dbKeys.length === 0) {
  dbKeys = [
    {
      key: 'PWPRO-VIP-2026',
      isUsed: false,
      deviceId: null,
      createdAt: new Date().toISOString(),
      usedAt: null,
      note: 'Demo Key',
    },
  ];
  saveKeys(dbKeys);
}

// ----------------------
// 1. MOBILE APP ACTIVATION ENDPOINT
// ----------------------
app.post('/api/activate', (req, res) => {
  const { key, deviceId } = req.body;

  if (!key || !deviceId) {
    return res.status(400).json({
      success: false,
      error: 'Activation key and Device ID are required.',
    });
  }

  const cleanKey = key.trim().toUpperCase();
  const keys = loadKeys();
  const existingKey = keys.find((k) => k.key === cleanKey);

  if (!existingKey) {
    return res.status(404).json({
      success: false,
      error: 'Invalid activation key. Please check spelling or contact admin.',
    });
  }

  // If already used
  if (existingKey.isUsed) {
    // If used on the same device, allow re-activation (restore)
    if (existingKey.deviceId === deviceId) {
      return res.json({
        success: true,
        message: 'Device license verified and restored.',
        key: cleanKey,
        activatedAt: existingKey.usedAt,
      });
    }

    return res.status(403).json({
      success: false,
      error: 'This key has already been activated on another device and cannot be reused.',
    });
  }

  // Consume key for this device
  existingKey.isUsed = true;
  existingKey.deviceId = deviceId;
  existingKey.usedAt = new Date().toISOString();
  saveKeys(keys);

  return res.json({
    success: true,
    message: 'App activated successfully! Welcome to PW Pro.',
    key: cleanKey,
    activatedAt: existingKey.usedAt,
  });
});

// ----------------------
// 2. ADMIN PANEL AUTH MIDDLEWARE
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
app.get('/api/admin/keys', checkAdminAuth, (req, res) => {
  const keys = loadKeys();
  const total = keys.length;
  const used = keys.filter((k) => k.isUsed).length;
  const available = total - used;

  res.json({
    stats: { total, used, available },
    keys: keys.reverse(), // latest first
  });
});

// Add or Generate Keys
app.post('/api/admin/keys', checkAdminAuth, (req, res) => {
  const { customKey, count = 1, prefix = 'PWPRO', note = '' } = req.body;
  const keys = loadKeys();
  const createdKeys = [];

  if (customKey && customKey.trim()) {
    const formatted = customKey.trim().toUpperCase();
    if (keys.some((k) => k.key === formatted)) {
      return res.status(400).json({ error: `Key "${formatted}" already exists.` });
    }

    const newKey = {
      key: formatted,
      isUsed: false,
      deviceId: null,
      createdAt: new Date().toISOString(),
      usedAt: null,
      note: note || 'Custom Admin Key',
    };
    keys.push(newKey);
    createdKeys.push(newKey);
  } else {
    // Generate bulk random keys
    const numToGen = Math.min(Math.max(parseInt(count) || 1, 1), 50);
    for (let i = 0; i < numToGen; i++) {
      const part1 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const part2 = Math.random().toString(36).substring(2, 6).toUpperCase();
      const generated = `${prefix.trim().toUpperCase()}-${part1}-${part2}`;

      if (!keys.some((k) => k.key === generated)) {
        const newEntry = {
          key: generated,
          isUsed: false,
          deviceId: null,
          createdAt: new Date().toISOString(),
          usedAt: null,
          note: note || 'Auto-generated',
        };
        keys.push(newEntry);
        createdKeys.push(newEntry);
      }
    }
  }

  saveKeys(keys);
  res.json({
    success: true,
    message: `Generated ${createdKeys.length} new key(s).`,
    created: createdKeys,
  });
});

// Delete or Revoke Key
app.delete('/api/admin/keys/:key', checkAdminAuth, (req, res) => {
  const targetKey = req.params.key.trim().toUpperCase();
  let keys = loadKeys();
  const initialLength = keys.length;

  keys = keys.filter((k) => k.key !== targetKey);

  if (keys.length === initialLength) {
    return res.status(404).json({ error: 'Key not found.' });
  }

  saveKeys(keys);
  res.json({ success: true, message: `Key ${targetKey} deleted.` });
});

// Reset key (un-bind from device to allow re-use)
app.post('/api/admin/keys/reset', checkAdminAuth, (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Key is required' });

  const targetKey = key.trim().toUpperCase();
  const keys = loadKeys();
  const item = keys.find((k) => k.key === targetKey);

  if (!item) return res.status(404).json({ error: 'Key not found' });

  item.isUsed = false;
  item.deviceId = null;
  item.usedAt = null;

  saveKeys(keys);
  res.json({ success: true, message: `Key ${targetKey} has been reset to unused.` });
});

app.listen(PORT, () => {
  console.log(`\n===========================================`);
  console.log(`🚀 PW Pro Admin Server running on port ${PORT}`);
  console.log(`🔑 Web Admin Panel: http://localhost:${PORT}`);
  console.log(`🛡️  Admin Password: ${ADMIN_PASSWORD}`);
  console.log(`===========================================\n`);
});
