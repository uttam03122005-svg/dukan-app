/* ================== CONFIG ================== */
const CONFIG = {
  GITHUB_USER: 'uttam03122005-svg',
  GITHUB_REPO: 'dukan-data',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE: 'data.json',
  GITHUB_TOKEN: '',

  CUST_REPO: 'dukan-customers',
  CUST_FILE: 'customers.json',
  CUST_BRANCH: 'main',
  CUST_TOKEN: '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',

  IMGBB_KEY: ''
};

const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.GITHUB_FILE}`;
const CUST_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.CUST_REPO}/${CONFIG.CUST_BRANCH}/${CONFIG.CUST_FILE}`;

const DEFAULT_DATA = { products: [], users: [], orders: [], owner: { id: 'owner', password: 'owner123' } };
const DEFAULT_CUST = { users: [] };

/* ================== TOAST ================== */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ================== LOAD ================== */
async function loadData() {
  try {
    const res = await fetch(DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('Data not found');
    const j = await res.json();
    j.products = j.products || [];
    j.users = j.users || [];
    j.orders = j.orders || [];
    j.owner = j.owner || { id: 'owner', password: 'owner123' };
    return j;
  } catch (e) {
    console.warn('loadData fail:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

async function loadCustomers() {
  try {
    const res = await fetch(CUST_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error('Customers not found');
    const j = await res.json();
    j.users = j.users || [];
    return j;
  } catch (e) {
    console.warn('loadCustomers fail:', e);
    return JSON.parse(JSON.stringify(DEFAULT_CUST));
  }
}

/* ================== SAVE ================== */
async function saveData(data) {
  const token = localStorage.getItem('gh_token') || CONFIG.GITHUB_TOKEN;
  if (!token) throw new Error('Owner token nahi mila. Login karo.');
  return await _githubSave(CONFIG.GITHUB_REPO, CONFIG.GITHUB_FILE, data, token);
}

async function saveCustomers(data) {
  return await _githubSave(CONFIG.CUST_REPO, CONFIG.CUST_FILE, data, CONFIG.CUST_TOKEN);
}

async function _githubSave(repo, file, data, token, retry = 0) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${repo}/contents/${file}`;

  const getRes = await fetch(apiUrl + '?ref=main&t=' + Date.now(), {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
  });
  let sha = null;
  if (getRes.ok) {
    const f = await getRes.json();
    sha = f.sha;
  } else if (getRes.status !== 404) {
    const err = await getRes.json().catch(() => ({}));
    throw new Error('Read fail: ' + (err.message || getRes.status));
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
      message: 'update ' + file + ' ' + new Date().toISOString(),
      content,
      sha: sha || undefined,
      branch: 'main'
    })
  });

  if (!putRes.ok) {
    const err = await putRes.json().catch(() => ({}));
    if (putRes.status === 409 && retry < 3) {
      await new Promise(r => setTimeout(r, 500 * (retry + 1)));
      return await _githubSave(repo, file, data, token, retry + 1);
    }
    if (putRes.status === 401) throw new Error('Token galat ya expire');
    if (putRes.status === 403) throw new Error('Permission nahi');
    if (putRes.status === 409) throw new Error('Conflict — page refresh karke dobara try karo');
    throw new Error('Save fail: ' + (err.message || putRes.status));
  }
  return true;
}

/* ================== IMAGE UPLOAD ================== */
async function uploadImage(file) {
  const key = localStorage.getItem('imgbb_key') || CONFIG.IMGBB_KEY;
  if (!key) throw new Error('ImgBB key nahi mili');
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success) throw new Error('Image upload fail');
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
  try { return { role, data: JSON.parse(localStorage.getItem('session') || '{}') }; }
  catch { return null; }
}
function logout() {
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  localStorage.removeItem('gh_token');
  localStorage.removeItem('imgbb_key');
  location.href = 'index.html';
}

/* ================== UNIT HELPERS ================== */
const UNIT_LABEL = {
  kg:'kg', gram:'g', liter:'L', ml:'ml', piece:'pc',
  packet:'pkt', box:'box', dozen:'doz', strip:'strip', bottle:'bottle'
};
// Har unit ka step (kitna increment)
const UNIT_STEP = {
  kg: 0.25, gram: 50, liter: 0.25, ml: 50,
  piece: 1, packet: 1, box: 1, dozen: 1, strip: 1, bottle: 1
};

/* ================== PRICE LOGIC ================== */
// Product me units array hai — user ne jo unit select kiya uska price return
function getUnitPrice(product, unitLabel, user) {
  const u = product.units?.find(x => x.label === unitLabel);
  if (!u) return 0;

  // Special price check (per product + unit) — owner ne diya ho
  if (user && user.special_prices) {
    const key = product.id + ':' + unitLabel;
    if (user.special_prices[key] != null) return user.special_prices[key];
    // fallback: purana format (product only)
    if (user.special_prices[product.id] != null) return user.special_prices[product.id];
  }

  if (user && user.price_type === 'wholesale') return u.wholesale;
  return u.retail;
}

// Product ka "default" (pehla) unit ka price
function getDefaultUnitPrice(product, user) {
  const first = product.units?.[0];
  if (!first) return 0;
  return getUnitPrice(product, first.label, user);
}

/* ================== HELPERS ================== */
function inr(n) { const v = Number(n) || 0; return '₹' + (v % 1 === 0 ? v : v.toFixed(2)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
