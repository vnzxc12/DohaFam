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
const TMP_DATA_FILE = path.join(os.tmpdir(), 'wishes.json');

// Supabase setup
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nkctcwwbgqrqmfcqfksa.supabase.co';
let SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
let supabase = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log(`✨ Supabase client initialized for: ${SUPABASE_URL}`);
  } catch (err) {
    console.warn(`⚠️ Supabase init warning: ${err.message}`);
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Read local/tmp data
function readLocalData() {
  try {
    // If in Vercel and tmp copy exists, read that
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
        const cloudMembers = data.map(row => ({
          id: row.id,
          name: row.name,
          avatar: row.avatar,
          updatedAt: row.updated_at,
          wishes: row.wishes || []
        }));

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

// GET network info
app.get('/api/network-info', (req, res) => {
  const ips = getLocalIPs();
  const primaryIP = ips.find(ip => ip.startsWith('10.') || ip.startsWith('192.168.')) || ips[0] || 'localhost';
  res.json({
    port: PORT,
    ips,
    primaryIP,
    mobileUrl: `http://${primaryIP}:${PORT}`,
    supabaseConfigured: Boolean(supabase),
    supabaseUrl: SUPABASE_URL
  });
});

// UPDATE wishes for a specific member
app.put('/api/members/:id/wishes', async (req, res) => {
  const { id } = req.params;
  const { wishes } = req.body;

  if (!Array.isArray(wishes)) {
    return res.status(400).json({ error: 'wishes must be an array' });
  }

  const data = readLocalData();
  const memberIndex = data.members.findIndex(m => m.id.toLowerCase() === id.toLowerCase());

  if (memberIndex === -1) {
    return res.status(404).json({ error: 'Member not found' });
  }

  const sanitizedWishes = wishes.slice(0, 3).map((w, index) => ({
    id: index + 1,
    title: (w.title || '').trim(),
    note: (w.note || '').trim(),
    link: (w.link || '').trim(),
    claimed: Boolean(w.claimed)
  }));

  while (sanitizedWishes.length < 3) {
    sanitizedWishes.push({
      id: sanitizedWishes.length + 1,
      title: '',
      note: '',
      link: '',
      claimed: false
    });
  }

  const nowIso = new Date().toISOString();
  data.members[memberIndex].wishes = sanitizedWishes;
  data.members[memberIndex].updatedAt = nowIso;

  writeLocalData(data);

  if (supabase) {
    try {
      await supabase
        .from('wishlist_members')
        .upsert({
          id: data.members[memberIndex].id,
          name: data.members[memberIndex].name,
          avatar: data.members[memberIndex].avatar,
          wishes: sanitizedWishes,
          updated_at: nowIso
        });
    } catch (e) {
      console.warn('Supabase sync error:', e.message);
    }
  }

  res.json({ success: true, member: data.members[memberIndex] });
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

// Start local server if not running on Vercel
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
