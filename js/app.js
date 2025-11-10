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
  /* JS moved to public/js/app.js. Keep a tiny file so references don't 404. */
  console.info('Frontend moved to /public — open / to view the app.');
      e.preventDefault();
    });
  });

  // Initialize UI based on token
  updateAuthUI();

});
