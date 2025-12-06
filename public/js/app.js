document.addEventListener('DOMContentLoaded',()=>{

  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');
  const closeButtons = document.querySelectorAll('[data-close]');
  const addStoreBtn = document.getElementById('addStoreBtn');
  const addStoreBtn2 = document.getElementById('addStoreBtn2');
  const addStoreModal = document.getElementById('addStoreModal');
  const addStoreForm = document.getElementById('addStoreForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const getStartedBtn = document.getElementById('getStartedBtn');
  const learnMoreBtn = document.getElementById('learnMoreBtn');
  const welcomeScreen = document.getElementById('welcome-screen');
  const featuresSection = document.getElementById('features-section');
  const dashboard = document.getElementById('dashboard');
  const storesList = document.getElementById('storesList');
  const runTestBtn = document.getElementById('runTestBtn');
  const testResults = document.getElementById('testResults');

  function openModal(modal){ modal.setAttribute('aria-hidden','false'); }
  function closeModal(modal){ modal.setAttribute('aria-hidden','true'); }

  loginBtn?.addEventListener('click',()=>openModal(loginModal));
  signupBtn?.addEventListener('click',()=>openModal(signupModal));
  addStoreBtn?.addEventListener('click',()=>openModal(addStoreModal));
  addStoreBtn2?.addEventListener('click',()=>openModal(addStoreModal));
  getStartedBtn?.addEventListener('click',()=>openModal(signupModal));
  learnMoreBtn?.addEventListener('click',()=>{
    featuresSection?.scrollIntoView({ behavior: 'smooth' });
  });
  
  closeButtons.forEach(btn => btn.addEventListener('click', e=>{
    const modal = e.target.closest('.modal');
    if(modal) closeModal(modal);
  }));
  document.querySelectorAll('.modal').forEach(m=>{ m.addEventListener('click', e=>{ if(e.target === m) closeModal(m); }); });

  // API base: if the page is opened via file://, assume server is at http://localhost:3000
  const DEFAULT_SERVER = 'http://localhost:3000';
  const BASE = (window.location.protocol === 'file:') ? DEFAULT_SERVER : '';
  const API = (path) => `${BASE}/api${path}`;

  // ----- Bot Detection: Behavioral Tracking -----
  const trackingData = {
    mouse_movements: [],
    keystrokes: [],
    page_load_time: performance.now(),
    time_on_page: null,
    form_submission_time: null,
    navigation_pattern: [],
    screen_resolution: { width: window.screen.width, height: window.screen.height },
    user_agent: navigator.userAgent,
  };

  // Sample mouse movements every 50ms
  document.addEventListener('mousemove', (event) => {
    const now = performance.now();
    const lastMove = trackingData.mouse_movements.at(-1);
    if (!lastMove || (now - lastMove.timestamp > 50)) {
      trackingData.mouse_movements.push({
        x: event.clientX,
        y: event.clientY,
        timestamp: now,
      });
    }
  });

  // Track keystrokes
  document.addEventListener('keydown', (event) => {
    trackingData.keystrokes.push({
      key: event.key,
      timestamp: performance.now(),
    });
  });

  // Track navigation/clicks
  document.addEventListener('click', (event) => {
    trackingData.navigation_pattern.push({
      element_id: event.target.id || event.target.tagName,
      timestamp: performance.now(),
    });
  });

  // Send tracking data
  async function sendTrackingData(context = 'unknown') {
    try {
      trackingData.form_submission_time = performance.now();
      trackingData.time_on_page = trackingData.form_submission_time - trackingData.page_load_time;
      const payload = { ...trackingData, context };
      const res = await fetch(API('/track-behavior'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      console.log('Tracking data sent:', result);
      return result;
    } catch (err) {
      console.warn('Failed to send tracking data:', err);
      return null;
    }
  }

  // Reset tracking data
  function resetTrackingData() {
    trackingData.mouse_movements = [];
    trackingData.keystrokes = [];
    trackingData.navigation_pattern = [];
    trackingData.page_load_time = performance.now();
    trackingData.form_submission_time = null;
    trackingData.time_on_page = null;
  }

  // Auth helpers
  function setToken(t){ if(t) localStorage.setItem('sb_token', t); else localStorage.removeItem('sb_token'); updateAuthUI(); }
  function getToken(){ return localStorage.getItem('sb_token'); }
  function authHeaders(){ const t = getToken(); return t ? { 'Authorization': 'Bearer '+t } : {}; }

  // Helper: escape HTML
  function escapeHtml(str){ if(!str) return ''; return String(str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[m]); }

  // ----- Local/demo auth fallback helpers (useful when server is offline) -----
  function localUsersKey(){ return 'sb_local_users_v1'; }
  function readLocalUsers(){
    try{ return JSON.parse(localStorage.getItem(localUsersKey())||'[]'); }catch(e){ return []; }
  }
  function writeLocalUsers(u){ localStorage.setItem(localUsersKey(), JSON.stringify(u||[])); }
  function localSignup(email, password){
    email = (email||'').toLowerCase();
    const users = readLocalUsers();
    if(users.find(x=>x.email===email)) return false;
    // Simple demo-only storage: DO NOT use this for real passwords.
    users.push({ id: 'local:'+Date.now(), email, pw: btoa(password||'') , createdAt: Date.now() });
    writeLocalUsers(users);
    return true;
  }
  function localLogin(email, password){
    email = (email||'').toLowerCase();
    const users = readLocalUsers();
    const u = users.find(x=>x.email===email && x.pw === btoa(password||''));
    return !!u;
  }
  function createLocalToken(email){
    // Not a real JWT. Just a local demo token so client knows user is logged in.
    const t = { type:'local', sub: email, iat: Date.now() };
    return 'local.'+btoa(JSON.stringify(t));
  }

  // Local stores helpers (demo fallback)
  function localStoresKey(){ return 'sb_local_stores_v1'; }
  function readLocalStores(){
    try{ return JSON.parse(localStorage.getItem(localStoresKey())||'[]'); }catch(e){ return []; }
  }
  function writeLocalStores(s){ localStorage.setItem(localStoresKey(), JSON.stringify(s||[])); }
  function parseLocalTokenEmail(){
    const t = getToken();
    if(!t || !t.startsWith('local.')) return null;
    try{
      const payload = JSON.parse(atob(t.slice(6)));
      return payload.sub || null;
    }catch(e){ return null; }
  }
  // Try to parse a JWT (no verification) to extract payload fields like sub/email.
  function parseJwt(token){
    if(!token) return null;
    try{
      const parts = token.split('.');
      if(parts.length < 2) return null;
      const payload = JSON.parse(atob(parts[1]));
      return payload;
    }catch(e){ return null; }
  }

  // Local/demo store creation. Accept optional ownerId/ownerEmail so stores saved during
  // a server outage can still be associated with the authenticated account.
  function localAddStore(name, description, ownerId=null, ownerEmail=null){
    name = (name||'').toString().trim();
    description = (description||'').toString().trim();
    if(!name) return false;
    const stores = readLocalStores();
    const localTokenEmail = parseLocalTokenEmail();
    const id = 'localstore:'+Date.now()+':'+Math.floor(Math.random()*1000);
    // Determine owner fields: prefer explicit args, then local token, else use generated id.
    const finalOwnerEmail = ownerEmail || localTokenEmail || null;
    const finalOwnerId = ownerId || (finalOwnerEmail ? ('local:'+finalOwnerEmail) : id);
    const store = { id, ownerId: finalOwnerId, ownerEmail: finalOwnerEmail, name, description, status: 'pending', createdAt: Date.now() };
    stores.push(store);
    writeLocalStores(stores);
    return true;
  }


  async function updateAuthUI(){
    const isLocal = (localStorage.getItem('localMode') === 'true');
    const token = localStorage.getItem('token');

    if(isLocal || token){
      // Logged in - show dashboard
      loginBtn.style.display = 'none';
      signupBtn.style.display = 'none';
      addStoreBtn.style.display = 'inline-block';
      logoutBtn.style.display = 'inline-block';
      welcomeScreen.style.display = 'none';
      featuresSection.style.display = 'none';
      dashboard.style.display = 'block';
      dashboard.style.display = 'block';
    } else {
      // Logged out - show welcome screen
      loginBtn.style.display = 'inline-block';
      signupBtn.style.display = 'inline-block';
      addStoreBtn.style.display = 'none';
      logoutBtn.style.display = 'none';
      welcomeScreen.style.display = 'block';
      featuresSection.style.display = 'block';
      dashboard.style.display = 'none';
    }

    // Load stores for the current user
    await loadStores();
    updateStats();

    // Admin UI
    if(isLocal){
      document.getElementById('admin-panel').style.display = 'none';
    } else if(token){
      try{
        const me = await loadMe();
        if(me && me.isAdmin){
          document.getElementById('admin-panel').style.display = 'block';
          await loadPendingStores();
        } else {
          document.getElementById('admin-panel').style.display = 'none';
        }
      }catch(err){
        console.warn('Failed to load /me for admin status', err);
        document.getElementById('admin-panel').style.display = 'none';
      }
    } else {
      document.getElementById('admin-panel').style.display = 'none';
    }
  }

  // Update dashboard stats
  function updateStats() {
    const stores = JSON.parse(localStorage.getItem('stores') || '[]');
    const totalStores = stores.filter(s => s.ownerId === (localStorage.getItem('userId') || '')).length;
    
    document.getElementById('totalStores').textContent = totalStores;
    document.getElementById('requestsToday').textContent = Math.floor(Math.random() * 500);
    document.getElementById('threatsBlocked').textContent = Math.floor(Math.random() * 50);
    document.getElementById('avgRiskScore').textContent = Math.floor(Math.random() * 30 + 10);
  }

  // Load current user info
  async function loadMe(){
    try{
      const res = await fetch(API('/me'), { headers: authHeaders() });
      if(!res.ok) return null;
      return await res.json();
    }catch(err){ return null; }
  }

  // Load pending stores (admin)
  async function loadPendingStores(){
    const pending = document.getElementById('pendingStoresList');
    if(!pending) return;
    try{
      const res = await fetch(API('/stores/pending'), { headers: authHeaders() });
      if(!res.ok){ pending.innerHTML = '<p class="muted">No pending stores.</p>'; return; }
      const data = await res.json();
      if(!Array.isArray(data) || data.length === 0){ pending.innerHTML = '<p class="muted">No pending stores.</p>'; return; }
      pending.innerHTML = '';
      data.forEach(s=>{
        const el = document.createElement('div');
        el.className = 'store-item';
        const ownerLabel = s.ownerEmail ? s.ownerEmail : (s.ownerId || '');
        el.innerHTML = `
          <div class="store-header">
            <div class="store-name">${escapeHtml(s.name)}</div>
            <span class="store-status pending">Pending</span>
          </div>
          <div class="store-description">Owner: ${escapeHtml(ownerLabel)}</div>
          <div class="store-description">${escapeHtml(s.description||'No description')}</div>
          <div class="store-actions">
            <button class="btn btn-primary approve-btn" data-id="${s.id}">Approve</button>
            <button class="btn btn-outline reject-btn" data-id="${s.id}">Reject</button>
          </div>
        `;
        pending.appendChild(el);
      });
      
      // Add event listeners
      pending.querySelectorAll('.approve-btn').forEach(btn => {
        btn.addEventListener('click', () => approveStore(btn.dataset.id));
      });
      pending.querySelectorAll('.reject-btn').forEach(btn => {
        btn.addEventListener('click', () => rejectStore(btn.dataset.id));
      });
    }catch(err){
      console.error('loadPendingStores', err);
      pending.innerHTML = '<p class="muted">No pending stores.</p>';
    }
  }

  async function approveStore(id){
    try{
      const res = await fetch(API(`/stores/${id}/status`), { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify({ status: 'approved' }) });
      const data = await res.json();
      if(res.ok){ alert('Store approved'); loadPendingStores(); loadStores(); }
      else alert(data.error || 'Failed to approve');
    }catch(err){ console.error(err); alert('Network error'); }
  }

  async function rejectStore(id){
    try{
      const res = await fetch(API(`/stores/${id}/status`), { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body: JSON.stringify({ status: 'rejected' }) });
      const data = await res.json();
      if(res.ok){ alert('Store rejected'); loadPendingStores(); }
      else alert(data.error || 'Failed to reject');
    }catch(err){ console.error(err); alert('Network error'); }
  }

  // Signup
  const signupForm = document.getElementById('signupForm');
  signupForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(signupForm);
    const payload = { email: form.get('email'), password: form.get('password') };
    
    // Capture tracking data before submission
    await sendTrackingData('signup');
    resetTrackingData();
    
    try{
      const res = await fetch(API('/signup'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ setToken(data.token); closeModal(signupModal); alert('Account created.'); }
      else alert(data.error || 'Signup failed');
    }catch(err){
      console.warn('Signup network error, falling back to local demo auth', err);
      // Fallback: save demo user locally for offline/demo mode
      try{
        const ok = localSignup(payload.email, payload.password);
        if(ok){
          const token = createLocalToken(payload.email);
          setToken(token);
          closeModal(signupModal);
          alert('Account created (local demo mode).');
        } else {
          alert('Local signup failed: user already exists');
        }
      }catch(ferr){
        console.error('Local signup error', ferr);
        alert('Signup failed');
      }
    }
  });

  // Login
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(loginForm);
    const payload = { email: form.get('email'), password: form.get('password') };
    
    // Capture tracking data before submission
    await sendTrackingData('login');
    resetTrackingData();
    
    try{
      const res = await fetch(API('/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ setToken(data.token); closeModal(loginModal); alert('Logged in'); }
      else alert(data.error || 'Login failed');
    }catch(err){
      console.warn('Login network error, trying local demo auth', err);
      try{
        const ok = localLogin(payload.email, payload.password);
        if(ok){
          const token = createLocalToken(payload.email);
          setToken(token);
          closeModal(loginModal);
          alert('Logged in (local demo mode)');
        } else {
          alert('Local login failed: invalid credentials');
        }
      }catch(ferr){
        console.error('Local login error', ferr);
        alert('Login failed');
      }
    }
  });

  // Logout
  logoutBtn.addEventListener('click', ()=>{ setToken(null); alert('Logged out'); });

  // Add store
  addStoreForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(addStoreForm);
    const payload = { name: form.get('name'), description: form.get('description') };
    
    // Capture tracking data before submission
    await sendTrackingData('add_store');
    resetTrackingData();
    
    // If using local demo token, create store locally
    const token = getToken();
    if(token && token.startsWith('local.')){
      const ok = localAddStore(payload.name, payload.description);
      if(ok){ closeModal(addStoreModal); addStoreForm.reset(); alert('Store saved locally (demo mode)'); loadStores(); }
      else alert('Failed to save local store');
      return;
    }

    try{
      const res = await fetch(API('/stores'), { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ closeModal(addStoreModal); addStoreForm.reset(); alert('Store submitted — pending verification'); loadStores(); }
      else {
        // if server responded but rejected, show message
        alert(data.error || 'Submit failed');
      }
    }catch(err){
      console.warn('Add store network error, saving locally as demo fallback', err);
      try{
        const token = getToken();
        if(token && !token.startsWith('local.')){
          const parsed = parseJwt(token);
          const ownerId = parsed && parsed.sub ? parsed.sub : null;
          const ownerEmail = parsed && parsed.email ? parsed.email : null;
          const ok = localAddStore(payload.name, payload.description, ownerId, ownerEmail);
          if(ok){ closeModal(addStoreModal); addStoreForm.reset(); alert('Store saved locally (demo fallback)'); loadStores(); }
          else alert('Failed to save local store');
        } else {
          const ok = localAddStore(payload.name, payload.description);
          if(ok){ closeModal(addStoreModal); addStoreForm.reset(); alert('Store saved locally (demo fallback)'); loadStores(); }
          else alert('Failed to save local store');
        }
      }catch(ferr){ console.error('local fallback failed', ferr); alert('Failed to save local store'); }
    }
  });

  // Load stores for current user
  async function loadStores(){
    try{
      const res = await fetch(API('/stores/my'), { headers: authHeaders() });
      const data = await res.json();
      // Render stores
      if(!storesList) return;
      if(!Array.isArray(data) || data.length === 0){
        storesList.innerHTML = '<p class="muted">No stores yet. Use "Add Store" to create one.</p>';
        return;
      }
      storesList.innerHTML = '';
      data.forEach(s=>{
        const el = document.createElement('div');
        el.className = 'card';
        el.style.marginBottom = '8px';
        el.innerHTML = `<strong>${escapeHtml(s.name)}</strong><div class="muted">Status: ${escapeHtml(s.status||'')}</div><div style="margin-top:6px">${escapeHtml(s.description||'')}</div>`;
        storesList.appendChild(el);
      });
    }catch(err){
      console.warn('Failed to load stores from server, falling back to local stores', err);
      // Fallback: load local stores for the current user only
      try{
        const token = getToken();
        let local = readLocalStores() || [];
        if(token && token.startsWith('local.')){
          const ownerEmail = parseLocalTokenEmail();
          if(ownerEmail){ local = local.filter(s => s.ownerEmail === ownerEmail || s.ownerId === ('local:'+ownerEmail)); }
          else local = [];
        } else if(token){
          const parsed = parseJwt(token);
          const ownerId = parsed && parsed.sub ? parsed.sub : null;
          const ownerEmail = parsed && parsed.email ? parsed.email : null;
          if(ownerId || ownerEmail){
            local = local.filter(s => (ownerId && s.ownerId === ownerId) || (ownerEmail && s.ownerEmail === ownerEmail));
          } else local = [];
        } else {
          // no token: show nothing for private stores
          local = [];
        }

        if(!storesList) return;
        if(!Array.isArray(local) || local.length === 0){
          storesList.innerHTML = '<p class="muted">No stores yet. Click "Add Store" to get started.</p>';
          return;
        }
        storesList.innerHTML = '';
        local.forEach(s=>{
          const el = document.createElement('div');
          el.className = 'store-item';
          const statusClass = s.status === 'approved' ? 'approved' : 'pending';
          el.innerHTML = `
            <div class="store-header">
              <div class="store-name">${escapeHtml(s.name)}</div>
              <span class="store-status ${statusClass}">${escapeHtml(s.status||'pending')}</span>
            </div>
            <div class="store-description">${escapeHtml(s.description||'No description')}</div>
          `;
          storesList.appendChild(el);
        });
        updateStats();
      }catch(fall){ console.error('Local stores load failed', fall); storesList.innerHTML = '<p class="muted">No stores yet. Click "Add Store" to get started.</p>'; }
    }
  }


  // API Testing Tool
  if(runTestBtn){
    runTestBtn.addEventListener('click', async ()=>{
      const ip = document.getElementById('testIp').value;
      const session = document.getElementById('testSession').value;
      const speed = parseInt(document.getElementById('testSpeed').value);

      const payload = {
        ip_address: ip,
        user_agent: navigator.userAgent,
        timestamp: Date.now(),
        product_id: "SKU-TEST",
        session_id: session,
        checkout_speed_ms: speed
      };

      try {
        const res = await fetch(API('/score/transaction'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        const data = await res.json();
        
        // Display results
        testResults.style.display = 'block';
        document.getElementById('resultScore').textContent = data.risk_score || '--';
        
        const actionBadge = document.getElementById('resultAction');
        const action = data.recommended_action || 'UNKNOWN';
        actionBadge.textContent = action;
        actionBadge.className = 'badge ' + action.toLowerCase();
        
        document.getElementById('resultBreakdown').textContent = JSON.stringify(data.breakdown || {}, null, 2);
      } catch(err) {
        console.error('Test API error:', err);
        alert('API test failed. Make sure the server is running.');
      }
    });
  }

  // Initialize UI based on token
  updateAuthUI();

});
