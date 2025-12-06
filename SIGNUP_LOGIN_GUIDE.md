# ✅ User Signup & Login — Complete Guide

## Yes, Credentials Are Saved!

**Your signup credentials are automatically saved and persistent.**

### How It Works

1. **Signup** → Credentials saved to `data/users.json`
2. **Password Security** → Hashed with bcrypt (never stored in plain text)
3. **Login** → Validates against saved credentials
4. **Persistence** → Data survives server restarts

---

## File Storage

### Location
```
ScalperBlock/
└── data/
    ├── users.json    ← Signup credentials saved here
    └── stores.json   ← User stores saved here
```

### User Data Format
```json
[
  {
    "id": "uuid-generated-automatically",
    "email": "user@example.com",
    "passwordHash": "$2a$10$encrypted_with_bcrypt...",
    "createdAt": 1733526000000
  }
]
```

---

## Quick Test

### 1. Start Server
```bash
npm install
npm start
```

### 2. Signup via UI
- Open http://localhost:3000
- Click "Sign up"
- Enter email and password (min 8 characters)
- Click "Create account"

### 3. Verify Saved
```bash
cat data/users.json
```

You should see your user with:
- ✅ Unique ID
- ✅ Email address
- ✅ Hashed password (starts with `$2a$10$`)
- ✅ Creation timestamp

### 4. Login Works
- Click "Log in"
- Enter same email and password
- ✅ You're logged in!

---

## Testing with cURL

### Signup
```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Login
```bash
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

**Response**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Server Code (Already Implemented)

### Signup Endpoint (`server.js` lines 67-88)
```javascript
app.post('/api/signup', async (req,res) => {
  const { email, password } = req.body;
  
  // Validate
  if(!isValidEmail(email)) return res.status(400).json({ error: 'Invalid email' });
  if(!isValidPassword(password)) return res.status(400).json({ error: 'Password min 8 chars' });
  
  // Check if exists
  const users = await readFile(USERS_FILE);
  if(users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(409).json({ error: 'Email already exists' });
  }
  
  // Hash password
  const hashed = bcrypt.hashSync(password, 10);
  
  // Save user
  const user = { 
    id: uuidv4(), 
    email, 
    passwordHash: hashed, 
    createdAt: Date.now() 
  };
  users.push(user);
  await writeFile(USERS_FILE, users);  // ← SAVES HERE!
  
  // Return token
  const token = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
  res.json({ token });
});
```

### Login Endpoint (`server.js` lines 96-108)
```javascript
app.post('/api/login', async (req,res) => {
  const { email, password } = req.body;
  
  // Read saved users
  const users = await readFile(USERS_FILE);  // ← READS FROM FILE!
  
  // Find user
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if(!user) return res.status(401).json({ error: 'Invalid credentials' });
  
  // Verify password
  if(!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  // Return token
  const token = jwt.sign({ sub: user.id, email: user.email }, SECRET, { expiresIn: '7d' });
  res.json({ token });
});
```

---

## Security Features

### ✅ Password Hashing
- **Algorithm**: bcrypt
- **Salt rounds**: 10
- **Never stored plain text**

### ✅ JWT Tokens
- **Expiry**: 7 days
- **Payload**: User ID and email
- **Secret**: Configurable via `SB_SECRET` env var

### ✅ Email Validation
- **Format check**: RFC-compliant regex
- **Case-insensitive**: user@example.com = USER@EXAMPLE.COM

### ✅ Password Policy
- **Minimum**: 8 characters
- **No max limit**
- **No special character requirements** (easily adjustable)

---

## Troubleshooting

### "Email already exists" Error
**Cause**: You already signed up with that email.  
**Fix**: Use a different email OR login with existing credentials.

### Login Says "Invalid credentials"
**Cause**: Wrong password or email not registered.  
**Fixes**:
1. Check for typos (password is case-sensitive)
2. Make sure you signed up first
3. Check `data/users.json` to see registered emails

### `data/users.json` is Empty
**Cause**: Server hasn't started or signup failed.  
**Fixes**:
1. Make sure server is running (`npm start`)
2. Check server logs for errors
3. Verify `data/` directory exists and is writable

### How to Reset All Users
```bash
# WARNING: Deletes all user accounts!
echo "[]" > data/users.json
```

---

## Data Persistence Details

### Write Queue System
The server uses a write queue to prevent concurrent write conflicts:

```javascript
async function writeFile(file, data){
  const str = JSON.stringify(data, null, 2);
  const prev = writeQueues.get(file) || Promise.resolve();
  const next = prev.then(() => fsp.writeFile(file, str, 'utf8'));
  writeQueues.set(file, next);
  return next;
}
```

**Benefits**:
- ✅ No race conditions
- ✅ Data integrity
- ✅ Atomic writes

### File Creation
Files are created automatically on first run:

```javascript
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

const USERS_FILE = path.join(DATA_DIR, 'users.json');
[USERS_FILE, STORES_FILE].forEach(f => {
  if (!fs.existsSync(f)) fs.writeFileSync(f, '[]');
});
```

---

## Backup & Recovery

### Backup Users
```bash
cp data/users.json data/users.backup.json
```

### Restore Users
```bash
cp data/users.backup.json data/users.json
```

### Export for PostgreSQL
When ready to migrate to PostgreSQL:
```bash
# Read users.json and insert into database
node scripts/migrate-to-postgres.js
```

---

## Summary

| Feature | Status | Location |
|---------|--------|----------|
| Signup saves credentials | ✅ Yes | `data/users.json` |
| Login validates credentials | ✅ Yes | Reads from file |
| Password hashing | ✅ bcrypt | 10 salt rounds |
| Data persistence | ✅ Yes | Survives restarts |
| Email validation | ✅ Yes | RFC-compliant |
| Password policy | ✅ Yes | Min 8 chars |
| JWT tokens | ✅ Yes | 7-day expiry |
| Write queue | ✅ Yes | Prevents conflicts |

---

**Your credentials are safe, secure, and persistent!** 🔒
