/* ================== CONFIG ================== */
const CONFIG = {
  GITHUB_USER: 'uttam03122005-svg',
  GITHUB_REPO: 'dukan-data',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE: 'data.json',
  GITHUB_TOKEN: '',   // khali rakho — login se aayega
  IMGBB_KEY: ''       // khali rakho — login se aayega
};

const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.GITHUB_FILE}`;

/* ================== DEFAULT DATA ================== */
const DEFAULT_DATA = {
  products: [],
  users: [],
  orders: [],
  owner: { id: 'owner', password: 'owner123' }
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
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================== DATA LOAD (GitHub se) ================== */
async function loadData() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('Data not found');
    const j = await res.json();
    // safety: agar fields missing ho
    j.products = j.products || [];
    j.users = j.users || [];
    j.orders = j.orders || [];
    j.owner = j.owner || { id: 'owner', password: 'owner123' };
    return j;
  } catch (e) {
    console.warn('GitHub data load fail:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

/* ================== DATA SAVE (GitHub pe) ================== */
async function saveData(data) {
  const token = localStorage.getItem('gh_token') || CONFIG.GITHUB_TOKEN;
  if (!token) throw new Error('GitHub token nahi mila. Owner login karo.');

  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/contents/${CONFIG.GITHUB_FILE}`;

  // current sha
  const getRes = await fetch(apiUrl + '?ref=' + CONFIG.GITHUB_BRANCH, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json'
    }
  });
  let sha = null;
  if (getRes.ok) {
    const file = await getRes.json();
    sha = file.sha;
  } else if (getRes.status !== 404) {
    const err = await getRes.json().catch(() => ({}));
    throw new Error('GitHub read fail: ' + (err.message || getRes.status));
  }

  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));

  const putRes = await fetch(apiUrl, {
    method: 'PUT',
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/vnd.github+json'
    },
    body: JSON.stringify({
      message: 'update data ' + new Date().toISOString(),
      content,
      sha: sha || undefined,
      branch: CONFIG.GITHUB_BRANCH
    })
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    if (putRes.status === 401) throw new Error('Token galat ya expire ho gaya');
    if (putRes.status === 403) throw new Error('Token me permission nahi (Contents: Read+Write chahiye)');
    if (putRes.status === 409) throw new Error('Conflict — dobara try karo');
    throw new Error('GitHub save fail: ' + (err.message || putRes.status));
  }
  return true;
}

/* ================== IMAGE UPLOAD (ImgBB) ================== */
async function uploadImage(file) {
  const key = localStorage.getItem('imgbb_key') || CONFIG.IMGBB_KEY;
  if (!key) throw new Error('ImgBB key nahi mili. Dobara owner login karo.');
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: form
  });
  const json = await res.json();
  if (!json.success) throw new Error('Image upload fail: ' + (json.error?.message || 'unknown'));
  return json.data.url;
}

/* ================== AUTH ================== */
function saveSession(role, payload) {
  localStorage.setItem('role', role);
  localStorage.setItem('session', JSON.stringify(payload));
}
function getSession() {
  const role = localStorage.getItem('role');
  if (!role) return null;
  try {
    return { role, data: JSON.parse(localStorage.getItem('session') || '{}') };
  } catch { return null; }
}
function logout() {
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  localStorage.removeItem('gh_token');
  localStorage.removeItem('imgbb_key');
  location.href = 'index.html';
}

/* ================== PRICE LOGIC ================== */
// Default: sab ko RETAIL
// Wholesale user → wholesale price
// Special price (per product) → highest priority
function getUserPrice(product, user) {
  if (!user) return product.retail_price;
  if (user.special_prices && user.special_prices[product.id] != null) {
    return user.special_prices[product.id];
  }
  if (user.price_type === 'wholesale') {
    return product.wholesale_price;
  }
  return product.retail_price;
}

/* ================== HELPERS ================== */
function inr(n) {
  const v = Number(n) || 0;
  return '₹' + (v % 1 === 0 ? v : v.toFixed(2));
}
function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

/* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
