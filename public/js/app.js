document.addEventListener('DOMContentLoaded',()=>{

  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');
  const closeButtons = document.querySelectorAll('[data-close]');
  const addStoreBtn = document.getElementById('addStoreBtn');
  const addStoreModal = document.getElementById('addStoreModal');
  const addStoreForm = document.getElementById('addStoreForm');
  const logoutBtn = document.getElementById('logoutBtn');
  const storesSection = document.getElementById('my-stores');
  const storesList = document.getElementById('storesList');

  function openModal(modal){ modal.setAttribute('aria-hidden','false'); }
  function closeModal(modal){ modal.setAttribute('aria-hidden','true'); }

  loginBtn.addEventListener('click',()=>openModal(loginModal));
  signupBtn.addEventListener('click',()=>openModal(signupModal));
  addStoreBtn.addEventListener('click',()=>openModal(addStoreModal));
  closeButtons.forEach(btn => btn.addEventListener('click', e=>{
    const modal = e.target.closest('.modal');
    if(modal) closeModal(modal);
  }));
  document.querySelectorAll('.modal').forEach(m=>{ m.addEventListener('click', e=>{ if(e.target === m) closeModal(m); }); });

  // API base
  const API = (path) => `/api${path}`;

  // Auth helpers
  function setToken(t){ if(t) localStorage.setItem('sb_token', t); else localStorage.removeItem('sb_token'); updateAuthUI(); }
  function getToken(){ return localStorage.getItem('sb_token'); }
  function authHeaders(){ const t = getToken(); return t ? { 'Authorization': 'Bearer '+t } : {}; }

  function updateAuthUI(){
    const loggedIn = !!getToken();
    loginBtn.style.display = loggedIn ? 'none' : '';
    signupBtn.style.display = loggedIn ? 'none' : '';
    addStoreBtn.style.display = loggedIn ? '' : 'none';
    logoutBtn.style.display = loggedIn ? '' : 'none';
    if(loggedIn) loadStores();
  }

  // Signup
  const signupForm = document.getElementById('signupForm');
  signupForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(signupForm);
    const payload = { email: form.get('email'), password: form.get('password') };
    try{
      const res = await fetch(API('/signup'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ setToken(data.token); closeModal(signupModal); alert('Account created.'); }
      else alert(data.error || 'Signup failed');
    }catch(err){ alert('Network error'); }
  });

  // Login
  const loginForm = document.getElementById('loginForm');
  loginForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(loginForm);
    const payload = { email: form.get('email'), password: form.get('password') };
    try{
      const res = await fetch(API('/login'), { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ setToken(data.token); closeModal(loginModal); alert('Logged in'); }
      else alert(data.error || 'Login failed');
    }catch(err){ alert('Network error'); }
  });

  // Logout
  logoutBtn.addEventListener('click', ()=>{ setToken(null); alert('Logged out'); });

  // Add store
  addStoreForm.addEventListener('submit', async e=>{
    e.preventDefault();
    const form = new FormData(addStoreForm);
    const payload = { name: form.get('name'), description: form.get('description') };
    try{
      const res = await fetch(API('/stores'), { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, authHeaders()), body:JSON.stringify(payload) });
      const data = await res.json();
      if(res.ok){ closeModal(addStoreModal); addStoreForm.reset(); alert('Store submitted — pending verification'); loadStores(); }
      else alert(data.error || 'Submit failed');
    }catch(err){ alert('Network error'); }
  });

  // Load stores for current user
  async function loadStores(){
    try{
      const res = await fetch(API('/stores/my'), { headers: authHeaders() });
      const data = await res.json();
      console.log('stores', data);
    }catch(err){ console.error(err); }
  }

  // Simulate API request (existing code preserved)
  const sendSample = document.getElementById('sendSample');
  const sampleResponse = document.getElementById('sampleResponse');

  sendSample.addEventListener('click', ()=>{
    const simulated = {
      risk_score: 58,
      recommended_action: "CHALLENGE",
      breakdown: {
        ip_score: 20,
        velocity_score: 10,
        fingerprint_score: 8,
        behavior_score: 20
      }
    };
    sampleResponse.textContent = JSON.stringify(simulated, null, 2);
    sendSample.textContent = 'Simulated';
    setTimeout(()=> sendSample.textContent = 'Simulate Request', 1500);
  });

  // Initialize UI based on token
  updateAuthUI();

});
