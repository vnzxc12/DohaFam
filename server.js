require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'wishes.json');
const TMP_DATA_FILE = path.join(os.tmpdir(), 'doha_wishes.json');

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nkctcwwbgqrqmfcqfksa.supabase.co';
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '@admin123';
let supabase = null;

function initSupabase() {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    try {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log(`✨ Supabase client initialized for: ${SUPABASE_URL}`);
      return true;
    } catch (err) {
      console.warn(`⚠️ Supabase init warning: ${err.message}`);
      supabase = null;
      return false;
    }
  }
  return false;
}

initSupabase();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Read local/tmp data
function readLocalData() {
  try {
    if (process.env.VERCEL && fs.existsSync(TMP_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(TMP_DATA_FILE, 'utf-8'));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local data:', err);
    return { party: {}, members: [] };
  }
}

// Write local/tmp data safely
function writeLocalData(data) {
  try {
    const targetFile = process.env.VERCEL ? TMP_DATA_FILE : DATA_FILE;
    fs.writeFileSync(targetFile, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error writing local data:', err);
    return false;
  }
}

// Get LAN IPv4 addresses
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

// GET storage status (checks if Supabase is connected)
app.get('/api/status', async (req, res) => {
  let supabaseConnected = false;
  let supabaseMessage = 'Not configured';

  if (supabase) {
    try {
      const { data, error } = await supabase.from('wishlist_members').select('id').limit(1);
      if (!error) {
        supabaseConnected = true;
        supabaseMessage = 'Connected & Syncing';
      } else {
        supabaseMessage = `Error: ${error.message}`;
      }
    } catch (e) {
      supabaseMessage = e.message;
    }
  }

  res.json({
    supabaseUrl: SUPABASE_URL,
    supabaseConfigured: Boolean(SUPABASE_ANON_KEY),
    supabaseConnected,
    supabaseMessage,
    storageType: supabaseConnected ? 'supabase' : 'local'
  });
});

// Configure Supabase Anon Key dynamically
app.post('/api/config/supabase', async (req, res) => {
  const { anonKey } = req.body;
  if (!anonKey || !anonKey.trim()) {
    return res.status(400).json({ error: 'Anon key is required' });
  }

  try {
    SUPABASE_ANON_KEY = anonKey.trim();
    initSupabase();

    // Verify connection
    const { error } = await supabase.from('wishlist_members').select('id').limit(1);
    if (error) {
      return res.status(400).json({ error: `Connection failed: ${error.message}. Make sure you ran schema.sql in Supabase!` });
    }

    // Save to .env locally if not in Vercel
    if (!process.env.VERCEL) {
      const envContent = `PORT=${PORT}\nSUPABASE_URL=${SUPABASE_URL}\nSUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}\n`;
      fs.writeFileSync(path.join(__dirname, '.env'), envContent, 'utf-8');
    }

    res.json({ success: true, message: 'Connected to Supabase cloud database!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET entire vault data
app.get('/api/vault', async (req, res) => {
  const localData = readLocalData();

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('wishlist_members')
        .select('*')
        .order('name');

      if (!error && data && data.length > 0) {
        const cloudMembers = data.map(row => {
          const wishes = row.wishes || [];
          const isLocked = Boolean(row.locked !== undefined ? row.locked : wishes.some(w => w.locked));
          return {
            id: row.id,
            name: row.name,
            avatar: row.avatar,
            locked: isLocked,
            updatedAt: row.updated_at,
            wishes: wishes
          };
        });

        localData.members = cloudMembers;
        writeLocalData(localData);
        return res.json({ ...localData, storageSource: 'supabase' });
      }
    } catch (e) {
      console.warn('Supabase fetch failed, using local storage:', e.message);
    }
  }

  res.json({ ...localData, storageSource: 'local' });
});

// UPDATE wishes for a specific member
app.put('/api/members/:id/wishes', async (req, res) => {
  const { id } = req.params;
  const { wishes, password, lockAfterSave } = req.body;

  if (!Array.isArray(wishes)) {
    return res.status(400).json({ error: 'wishes must be an array' });
  }

  const localData = readLocalData();
  const memberIndex = localData.members.findIndex(m => m.id.toLowerCase() === id.toLowerCase());
  let member = memberIndex !== -1 ? localData.members[memberIndex] : null;

  // Check current lock status from Supabase first
  if (supabase) {
    try {
      const { data: cloudRow } = await supabase
        .from('wishlist_members')
        .select('*')
        .eq('id', id.toLowerCase())
        .single();

      if (cloudRow) {
        if (!member) {
          member = {
            id: cloudRow.id,
            name: cloudRow.name,
            avatar: cloudRow.avatar,
            wishes: cloudRow.wishes || []
          };
        }
        member.locked = Boolean(cloudRow.locked || (cloudRow.wishes && cloudRow.wishes.some(w => w.locked)));
      }
    } catch (e) {
      console.warn('Supabase check warning on PUT:', e.message);
    }
  }

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const isCurrentlyLocked = Boolean(member.locked);

  // If already locked, verify admin password before editing
  if (isCurrentlyLocked) {
    if (password !== ADMIN_PASSWORD) {
      return res.status(403).json({
        error: '🔒 This wishlist is locked! Only admin can modify it.',
        isLocked: true
      });
    }
  }

  // Determine target lock state
  let finalLockState = isCurrentlyLocked;
  if (lockAfterSave !== undefined) {
    finalLockState = Boolean(lockAfterSave);
  }

  const sanitizedWishes = wishes.slice(0, 3).map((w, index) => ({
    id: index + 1,
    title: (w.title || '').trim(),
    note: (w.note || '').trim(),
    link: (w.link || '').trim(),
    claimed: Boolean(w.claimed),
    locked: finalLockState
  }));

  while (sanitizedWishes.length < 3) {
    sanitizedWishes.push({
      id: sanitizedWishes.length + 1,
      title: '',
      note: '',
      link: '',
      claimed: false,
      locked: finalLockState
    });
  }

  const nowIso = new Date().toISOString();
  member.wishes = sanitizedWishes;
  member.locked = finalLockState;
  member.updatedAt = nowIso;

  if (memberIndex !== -1) {
    localData.members[memberIndex] = member;
    writeLocalData(localData);
  }

  let supabaseSaved = false;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('wishlist_members')
        .upsert({
          id: member.id,
          name: member.name,
          avatar: member.avatar,
          wishes: sanitizedWishes,
          updated_at: nowIso
        });

      if (!error) {
        supabaseSaved = true;
      } else {
        console.warn('Supabase upsert warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase sync error:', e.message);
    }
  }

  console.log(`💾 Saved wishes for ${member.name} (Locked: ${finalLockState}, Supabase: ${supabaseSaved})`);

  res.json({
    success: true,
    member,
    savedTo: {
      local: true,
      supabase: supabaseSaved
    }
  });
});

// TOGGLE LOCK on a member's wishlist (PRESERVES EXISTING WISHES)
app.post('/api/members/:id/lock', async (req, res) => {
  const { id } = req.params;
  const { password, locked } = req.body;

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }

  const targetLockState = Boolean(locked);
  const nowIso = new Date().toISOString();

  let member = null;
  let currentWishes = [];

  // 1. Fetch live row from Supabase first to preserve existing wishes
  if (supabase) {
    try {
      const { data: cloudRow, error } = await supabase
        .from('wishlist_members')
        .select('*')
        .eq('id', id.toLowerCase())
        .single();

      if (!error && cloudRow) {
        member = {
          id: cloudRow.id,
          name: cloudRow.name,
          avatar: cloudRow.avatar,
          locked: targetLockState,
          updatedAt: nowIso,
          wishes: cloudRow.wishes || []
        };
        currentWishes = member.wishes;
      }
    } catch (e) {
      console.warn('Supabase fetch error during lock toggle:', e.message);
    }
  }

  // 2. Fallback to local data if not found in Supabase
  const localData = readLocalData();
  const memberIndex = localData.members.findIndex(m => m.id.toLowerCase() === id.toLowerCase());

  if (!member && memberIndex !== -1) {
    member = localData.members[memberIndex];
    currentWishes = member.wishes || [];
  }

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // 3. Update ONLY the locked property on each existing wish slot
  member.locked = targetLockState;
  member.updatedAt = nowIso;

  if (Array.isArray(currentWishes)) {
    currentWishes.forEach(w => {
      w.locked = targetLockState;
    });
    member.wishes = currentWishes;
  }

  // 4. Update local cache
  if (memberIndex !== -1) {
    localData.members[memberIndex].locked = targetLockState;
    localData.members[memberIndex].wishes = currentWishes;
    localData.members[memberIndex].updatedAt = nowIso;
    writeLocalData(localData);
  }

  // 5. Update Supabase with preserved wishes
  let supabaseSaved = false;
  if (supabase) {
    try {
      const { error } = await supabase
        .from('wishlist_members')
        .update({
          wishes: currentWishes,
          updated_at: nowIso
        })
        .eq('id', member.id);

      if (!error) {
        supabaseSaved = true;
      } else {
        console.warn('Supabase lock update warning:', error.message);
      }
    } catch (e) {
      console.warn('Supabase sync error on lock toggle:', e.message);
    }
  }

  console.log(`🔐 Lock status updated for ${member.name}: ${targetLockState ? 'LOCKED' : 'UNLOCKED'} (Supabase: ${supabaseSaved})`);

  res.json({
    success: true,
    locked: targetLockState,
    member
  });
});

// TOGGLE claim on a wish
app.post('/api/members/:id/claim', async (req, res) => {
  const { id } = req.params;
  const { wishId } = req.body;

  const data = readLocalData();
  const member = data.members.find(m => m.id.toLowerCase() === id.toLowerCase());

  if (!member) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const wish = member.wishes.find(w => w.id === Number(wishId));
  if (!wish) {
    return res.status(404).json({ error: 'Wish slot not found' });
  }

  wish.claimed = !wish.claimed;
  const nowIso = new Date().toISOString();
  member.updatedAt = nowIso;

  writeLocalData(data);

  if (supabase) {
    try {
      await supabase
        .from('wishlist_members')
        .update({ wishes: member.wishes, updated_at: nowIso })
        .eq('id', member.id);
    } catch (e) {
      console.warn('Supabase sync error on claim:', e.message);
    }
  }

  res.json({ success: true, wish, member });
});

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    const ips = getLocalIPs();
    const primaryIP = ips.find(ip => ip.startsWith('10.') || ip.startsWith('192.168.')) || 'localhost';
    console.log(`\n======================================================`);
    console.log(`🎄 DOHA FAM CHRISTMAS PARTY 2026 - WISHLIST VAULT 🎄`);
    console.log(`======================================================`);
    console.log(`💻 Local:        http://localhost:${PORT}`);
    console.log(`📱 Mobile Wi-Fi: http://${primaryIP}:${PORT}`);
    console.log(`☁️ Supabase:     ${SUPABASE_URL}`);
    console.log(`======================================================\n`);
  });
}

module.exports = app;
