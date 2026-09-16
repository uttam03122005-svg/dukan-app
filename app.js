/* ================== CONFIG ================== */
// 🔴 APNI VALUES DAALO:
const CONFIG = {
  GITHUB_USER: 'yourname',
  GITHUB_REPO: 'dukan-data',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE: 'data.json',
  GITHUB_TOKEN: '', // owner login ke baad set hoga (localStorage me)
  IMGBB_KEY: 'YOUR_IMGBB_API_KEY' // https://api.imgbb.com/ se free lo
};

const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.GITHUB_FILE}`;

/* ================== DEFAULT DATA ================== */
const DEFAULT_DATA = {
  products: [],
  users: [],
  orders: [],
  owner: { id: 'owner', password: 'owner123' } // pehli baar, baad me change kar sakte ho
};

/* ================== TOAST ================== */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2000);
}

/* ================== DATA LOAD (GitHub se) ================== */
async function loadData() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('Data not found');
    return await res.json();
  } catch (e) {
    console.warn('GitHub data load fail, default use kar rahe:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

/* ================== DATA SAVE (GitHub pe) ================== */
async function saveData(data) {
  const token = localStorage.getItem('gh_token') || CONFIG.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub token nahi mila. Owner login karo.');

  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_FILE}`;

  // 1. current file ka sha nikalna
  const getRes = await fetch(apiUrl + '?ref=' + CONFIG.GITHUB_BRANCH, {
    headers: { Authorization: `token ${token}` }
  });
  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  }

  // 2. content base64 me
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

  // 3. PUT
  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'update data ' + new Date().toISOString(),
      content,
      sha: sha || undefined,
      branch: CONFIG.GITHUB_BRANCH
    })
  });

  if (!putRes.ok) {
    const err = await putRes.json();
    throw new Error('GitHub save fail: ' + (err.message || putRes.status));
  }
  return true;
}

/* ================== IMAGE UPLOAD (ImgBB) ================== */
async function uploadImage(file) {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${CONFIG.IMGBB_KEY}`, {
    method: 'POST',
    body: form
  });
  const json = await res.json();
  if (!json.success) throw new Error('Image upload fail');
  return json.data.url; // yahi URL JSON me save hoga
}

/* ================== AUTH ================== */
function saveSession(role, payload) {
  localStorage.setItem('role', role);
  localStorage.setItem('session', JSON.stringify(payload));
}

function getSession() {
  const role = localStorage.getItem('role');
  if (!role) return null;
  return {
    role,
    data: JSON.parse(localStorage.getItem('session') || '{}')
  };
}

function logout() {
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  localStorage.removeItem('gh_token');
  location.href = 'index.html';
}

/* ================== HELPERS ================== */
function getUserPrice(product, user) {
  if (!user) return product.retail_price;
  // special price check
  if (user.special_prices && user.special_prices[product.id] != null) {
    return user.special_prices[product.id];
  }
  if (user.price_type === 'wholesale') return product.wholesale_price;
  return product.retail_price;
}

function inr(n) { return '₹' + Number(n).toFixed(0); }

function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./service-worker.js').catch(() => {});
}
