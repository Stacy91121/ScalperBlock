const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const STORES_FILE = path.join(DATA_DIR, 'stores.json');
[USERS_FILE, STORES_FILE].forEach(f => { if (!fs.existsSync(f)) fs.writeFileSync(f, '[]'); });

// Use promises-based fs for async read/write and a simple per-file write queue
const fsp = fs.promises;
const writeQueues = new Map();

async function readFile(file){
  try{
    const t = await fsp.readFile(file, 'utf8');
    return JSON.parse(t || '[]');
  }catch(err){
    if(err.code === 'ENOENT') return [];
    throw err;
  }
}

async function writeFile(file, data){
  const str = JSON.stringify(data, null, 2);
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.then(() => fsp.writeFile(file, str, 'utf8'))
    .catch(() => fsp.writeFile(file, str, 'utf8'));
  writeQueues.set(file, next);
  return next;
}

const SECRET = process.env.SB_SECRET || 'dev-secret-key';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(cors());
app.use(express.json());
// Serve static files from `public/` directory.
app.use(express.static(path.join(__dirname, 'public')));

function authMiddleware(req,res,next){
  const h = req.headers.authorization;
  if(!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = h.split(' ')[1];
  try{
    const payload = jwt.verify(token, SECRET);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  }catch(err){ return res.status(401).json({ error: 'Invalid token' }); }
}

function isValidEmail(email){
  if(!email || typeof email !== 'string') return false;
  // simple RFC-like check
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

function isValidPassword(pw){
  return typeof pw === 'string' && pw.length >= 8;
}

function adminMiddleware(req, res, next){
  const adminEmail = process.env.SB_ADMIN_EMAIL;
  if(adminEmail && req.userEmail && req.userEmail.toLowerCase() === adminEmail.toLowerCase()) return next();
  return res.status(403).json({ error: 'Forbidden — admin only' });
}

// POST /api/signup
app.post('/api/signup', async (req,res) => {
  try{
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({ error: 'email and password required' });
    if(!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email format' });
    if(!isValidPassword(password)) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const users = await readFile(USERS_FILE);
    if(users.find(u => u.email.toLowerCase() === email.toLowerCase())) return res.status(409).json({ error: 'Email already exists' });
    const hashed = bcrypt.hashSync(password, 10);
    const user = { id: uuidv4(), email, passwordHash: hashed, createdAt: Date.now() };
    users.push(user);
    await writeFile(USERS_FILE, users);
    const token = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/login
app.post('/api/login', async (req,res) => {
  try{
    const { email, password } = req.body || {};
    if(!email || !password) return res.status(400).json({ error: 'email and password required' });
    const users = await readFile(USERS_FILE);
    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if(!user) return res.status(401).json({ error: 'Invalid credentials' });
    if(!bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
    res.json({ token });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/stores  (create a store — requires auth)
app.post('/api/stores', authMiddleware, async (req,res) => {
  try{
    let { name, description } = req.body || {};
    name = (name || '').toString().trim();
    description = (description || '').toString().trim();
    if(!name || name.length < 3) return res.status(400).json({ error: 'Store name required (min 3 chars)' });
    const stores = await readFile(STORES_FILE);
    const store = { id: uuidv4(), ownerId: req.userId, name, description, status: 'pending', createdAt: Date.now() };
    stores.push(store);
    await writeFile(STORES_FILE, stores);
    res.status(201).json(store);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/me — return current user info (no password hash)
app.get('/api/me', authMiddleware, async (req, res) => {
  try{
    const users = await readFile(USERS_FILE);
    const user = users.find(u => u.id === req.userId);
    if(!user) return res.status(404).json({ error: 'User not found' });
    const isAdmin = process.env.SB_ADMIN_EMAIL && user.email.toLowerCase() === process.env.SB_ADMIN_EMAIL.toLowerCase();
    res.json({ id: user.id, email: user.email, createdAt: user.createdAt, isAdmin });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin endpoint: update store status
app.post('/api/stores/:id/status', authMiddleware, adminMiddleware, async (req, res) => {
  try{
    const { status } = req.body || {};
    const allowed = ['pending','approved','rejected'];
    if(!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const stores = await readFile(STORES_FILE);
    const idx = stores.findIndex(s => s.id === req.params.id);
    if(idx === -1) return res.status(404).json({ error: 'Store not found' });
    stores[idx].status = status;
    stores[idx].updatedAt = Date.now();
    await writeFile(STORES_FILE, stores);
    res.json(stores[idx]);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores/my  (returns stores for logged-in user)
app.get('/api/stores/my', authMiddleware, async (req,res) => {
  try{
    const stores = await readFile(STORES_FILE);
    res.json(stores.filter(s => s.ownerId === req.userId));
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores  (optional: public listing)
app.get('/api/stores', async (req,res) => {
  try{
    const stores = await readFile(STORES_FILE);
    res.json(stores);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/stores/pending  (admin only)
app.get('/api/stores/pending', authMiddleware, adminMiddleware, async (req, res) => {
  try{
    const stores = await readFile(STORES_FILE);
    const users = await readFile(USERS_FILE);
    const usersById = new Map(users.map(u => [u.id, u]));
    const pending = stores.filter(s => s.status === 'pending').map(s => {
      const owner = usersById.get(s.ownerId);
      return Object.assign({}, s, { ownerEmail: owner ? owner.email : null });
    });
    res.json(pending);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/track-behavior (bot detection analysis)
app.post('/api/track-behavior', async (req, res) => {
  try {
    const { mouse_movements, keystrokes, navigation_pattern, time_on_page, context, screen_resolution, user_agent } = req.body || {};
    
    // Initialize risk score
    let risk_score = 0;
    const breakdown = {};

    // 1. Analyze mouse movements (human-like motion = curved, variable speed)
    if (Array.isArray(mouse_movements) && mouse_movements.length > 0) {
      let straight_distance = 0;
      let actual_distance = 0;
      for (let i = 1; i < mouse_movements.length; i++) {
        const prev = mouse_movements[i - 1];
        const curr = mouse_movements[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        actual_distance += Math.sqrt(dx * dx + dy * dy);
      }
      const straight_dist = Math.sqrt(
        (mouse_movements[mouse_movements.length - 1].x - mouse_movements[0].x) ** 2 +
        (mouse_movements[mouse_movements.length - 1].y - mouse_movements[0].y) ** 2
      );
      straight_distance = straight_dist;
      
      // Straightness ratio: close to 1 = suspicious (direct path), > 1 = human (curved path)
      const straightness = straight_distance > 0 ? actual_distance / straight_distance : 1;
      const movement_score = straightness < 1.2 ? 25 : (straightness < 1.5 ? 10 : 0);
      risk_score += movement_score;
      breakdown.mouse_movement_score = movement_score;

      // Check movement count: too few = bot, too many/realistic = human
      const movement_count_score = mouse_movements.length < 5 ? 15 : 0;
      risk_score += movement_count_score;
      breakdown.movement_count_score = movement_count_score;
    } else {
      // No mouse movements = suspicious
      risk_score += 35;
      breakdown.mouse_movement_score = 35;
    }

    // 2. Analyze keystrokes (timing patterns)
    if (Array.isArray(keystrokes) && keystrokes.length > 0) {
      let keystroke_intervals = [];
      for (let i = 1; i < keystrokes.length; i++) {
        keystroke_intervals.push(keystrokes[i].timestamp - keystrokes[i - 1].timestamp);
      }
      const avg_interval = keystroke_intervals.reduce((a, b) => a + b, 0) / keystroke_intervals.length;
      const variance = keystroke_intervals.reduce((sum, interval) => sum + (interval - avg_interval) ** 2, 0) / keystroke_intervals.length;

      // Low variance = suspicious (bot-like consistency), high variance = human (natural variation)
      const keystroke_consistency_score = variance < 50 ? 20 : (variance < 150 ? 8 : 0);
      risk_score += keystroke_consistency_score;
      breakdown.keystroke_consistency_score = keystroke_consistency_score;

      // Check for unnatural typing speed (too fast)
      const too_fast_keystrokes = keystroke_intervals.filter(interval => interval < 50).length;
      const speed_score = too_fast_keystrokes > keystroke_intervals.length * 0.5 ? 15 : 0;
      risk_score += speed_score;
      breakdown.typing_speed_score = speed_score;
    } else {
      // No keystrokes = suspicious
      risk_score += 30;
      breakdown.keystroke_score = 30;
    }

    // 3. Analyze navigation/interaction patterns
    if (Array.isArray(navigation_pattern) && navigation_pattern.length > 0) {
      // Too few clicks/interactions = suspicious
      const interaction_count_score = navigation_pattern.length < 3 ? 10 : 0;
      risk_score += interaction_count_score;
      breakdown.interaction_count_score = interaction_count_score;

      // Check for repeated identical element interactions (bot-like)
      const element_map = {};
      navigation_pattern.forEach(click => {
        element_map[click.element_id] = (element_map[click.element_id] || 0) + 1;
      });
      const max_repetitions = Math.max(...Object.values(element_map));
      const repetition_score = max_repetitions > 3 ? 12 : 0;
      risk_score += repetition_score;
      breakdown.repetition_score = repetition_score;
    } else {
      // No interactions = suspicious
      risk_score += 20;
      breakdown.interaction_score = 20;
    }

    // 4. Analyze time on page
    const time_on_page_score = (time_on_page < 1000 || time_on_page > 120000) ? 10 : 0;
    risk_score += time_on_page_score;
    breakdown.time_on_page_score = time_on_page_score;

    // Determine recommended action
    let recommended_action = 'ALLOW';
    if (risk_score >= 80) {
      recommended_action = 'BLOCK';
    } else if (risk_score >= 50) {
      recommended_action = 'CHALLENGE';
    }

    // Log the analysis
    console.log(`Bot detection (${context}): risk_score=${risk_score}, action=${recommended_action}`, breakdown);

    res.json({
      risk_score: Math.min(100, risk_score),
      recommended_action,
      breakdown,
      context,
    });
  } catch (err) {
    console.error('Track behavior error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, ()=> console.log(`ScalperBlock demo API running on http://localhost:${PORT}`));
