/* ================== CONFIG ================== */
const CONFIG = {
  GITHUB_USER: 'uttam03122005-svg',
  GITHUB_REPO: 'dukan-data',
  GITHUB_BRANCH: 'main',
  GITHUB_FILE: 'data.json',

  CUST_REPO: 'dukan-customers',
  CUST_FILE: 'customers.json',
  CUST_BRANCH: 'main',

  GITHUB_TOKEN: '',
  IMGBB_KEY: ''
};

const DATA_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.GITHUB_REPO}/${CONFIG.GITHUB_BRANCH}/${CONFIG.GITHUB_FILE}`;
const CUST_URL = `https://raw.githubusercontent.com/${CONFIG.GITHUB_USER}/${CONFIG.CUST_REPO}/${CONFIG.CUST_BRANCH}/${CONFIG.CUST_FILE}`;

const DEFAULT_DATA = {
  products: [], users: [], orders: [],
  owner: { id: 'owner', password: 'owner123' },
  settings: {}
};
const DEFAULT_CUST = { users: [] };

/* ================== TOAST ================== */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================== CACHE ================== */
let CACHED_DATA = null;

/* ================== TOKEN ================== */
async function getActiveToken() {
  const local = localStorage.getItem('gh_token');
  if (local) return local;
  if (CACHED_DATA?.settings?.gh_token) return CACHED_DATA.settings.gh_token;
  if (CONFIG.GITHUB_TOKEN) return CONFIG.GITHUB_TOKEN;
  return null;
}
async function getImgbbKey() {
  const local = localStorage.getItem('imgbb_key');
  if (local) return local;
  if (CACHED_DATA?.settings?.imgbb_key) return CACHED_DATA.settings.imgbb_key;
  if (CONFIG.IMGBB_KEY) return CONFIG.IMGBB_KEY;
  return null;
}
function getUpi() {
  return {
    id: localStorage.getItem('upi_id') || CACHED_DATA?.settings?.upi_id || '',
    name: localStorage.getItem('upi_name') || CACHED_DATA?.settings?.upi_name || 'Dukan'
  };
}

/* ================== LOAD ================== */
async function loadData() {
  try {
    const res = await fetch(DATA_URL + '?_=' + Date.now() + Math.random());
    if (!res.ok) throw new Error('Data not found');
    const j = await res.json();
    j.products = j.products || [];
    j.users = j.users || [];
    j.orders = j.orders || [];
    j.owner = j.owner || { id: 'owner', password: 'owner123' };
    j.settings = j.settings || {};
    CACHED_DATA = j;
    return j;
  } catch (e) {
    console.warn('loadData fail:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

async function loadCustomers() {
  try {
    const res = await fetch(CUST_URL + '?_=' + Date.now() + Math.random());
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
  const token = await getActiveToken();
  if (!token) throw new Error('Token set nahi hai. Owner login karo.');
  data.settings = data.settings || {};
  return await _githubSave(CONFIG.GITHUB_REPO, CONFIG.GITHUB_FILE, data, token);
}
async function saveCustomers(data) {
  const token = await getActiveToken();
  if (!token) throw new Error('Token set nahi hai');
  return await _githubSave(CONFIG.CUST_REPO, CONFIG.CUST_FILE, data, token);
}

async function _githubSave(repo, file, data, token, retry = 0) {
  const apiUrl = `https://api.github.com/repos/${CONFIG.GITHUB_USER}/${repo}/contents/${file}`;

  // Fresh sha — sirf Authorization aur Accept headers (CORS safe)
  const getRes = await fetch(apiUrl + '?ref=main&_=' + Date.now() + Math.random(), {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json'
    }
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

    if (putRes.status === 409 && retry < 5) {
      console.warn('Conflict — retry ' + (retry + 1));
      await new Promise(r => setTimeout(r, 800 * (retry + 1)));
      return await _githubSave(repo, file, data, token, retry + 1);
    }
    if (putRes.status === 401) throw new Error('Token galat ya expire');
    if (putRes.status === 403) throw new Error('Permission nahi');
    if (putRes.status === 409) throw new Error('Conflict — 10 sec ruk ke try karo');
    if (putRes.status === 422) throw new Error('Data format galat');

    throw new Error('Save fail: ' + (err.message || putRes.status));
  }
  return true;
}

/* ================== IMAGE ================== */
async function uploadImage(file) {
  const key = await getImgbbKey();
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
  localStorage.removeItem('upi_id');
  localStorage.removeItem('upi_name');
  location.replace('index.html');
}
function logoutUser() {
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  location.replace('index.html');
}

/* ================== UNITS ================== */
const UNIT_LABEL = {
  kg:'kg', gram:'g', liter:'L', ml:'ml', piece:'pc',
  packet:'pkt', box:'box', dozen:'doz', strip:'strip', bottle:'bottle'
};
const UNIT_STEP = {
  kg: 0.25, gram: 50, liter: 0.25, ml: 50,
  piece: 1, packet: 1, box: 1, dozen: 1, strip: 1, bottle: 1
};

/* ================== PRICE ================== */
function getUnitPrice(product, unitLabel, user) {
  const u = product.units?.find(x => x.label === unitLabel);
  if (!u) return 0;
  if (user && user.special_prices) {
    const key = product.id + ':' + unitLabel;
    if (user.special_prices[key] != null) return user.special_prices[key];
    if (user.special_prices[product.id] != null) return user.special_prices[product.id];
  }
  if (user && user.price_type === 'wholesale') return u.wholesale;
  return u.retail;
}

/* ================== HELPERS ================== */
function inr(n) { const v = Number(n) || 0; return '₹' + (v % 1 === 0 ? v : v.toFixed(2)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ================== UPI ================== */
function getUpiLink(amount, note) {
  const { id, name } = getUpi();
  if (!id) return '';
  const amt = Number(amount).toFixed(2);
  const tn = encodeURIComponent(note || 'Dukan Order');
  const pn = encodeURIComponent(name);
  const pa = encodeURIComponent(id);
  return `upi://pay?pa=${pa}&pn=${pn}&am=${amt}&cu=INR&tn=${tn}`;
}
function getUpiQrImage(amount, note) {
  const link = getUpiLink(amount, note);
  if (!link) return '';
  return `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(link)}`;
}
function getAppLinks(amount, note) {
  const { id, name } = getUpi();
  if (!id) return {};
  const amt = Number(amount).toFixed(2);
  const tn = encodeURIComponent(note || 'Dukan Order');
  const pn = encodeURIComponent(name);
  const pa = encodeURIComponent(id);
  const base = `pa=${pa}&pn=${pn}&am=${amt}&cu=INR&tn=${tn}`;
  return {
    gpay: `tez://upi/pay?${base}`,
    phonepe: `phonepe://pay?${base}`,
    paytm: `paytmmp://pay?${base}`,
    bhim: `bhim://pay?${base}`,
    any: `upi://pay?${base}`
  };
}

/* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
