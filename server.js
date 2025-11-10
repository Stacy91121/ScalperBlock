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

app.listen(PORT, ()=> console.log(`ScalperBlock demo API running on http://localhost:${PORT}`));
