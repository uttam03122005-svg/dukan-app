/* ================== SECRET ================== */
const SECRET_URL = './secret.json';

let SECRET = {
  gh_token: '',
  imgbb_key: '',
  upi_id: '',
  upi_name: 'Dukan',
  firebase: {}
};

let FB = null;
let FB_READY = false;
let FB_READY_RESOLVE = null;
const FB_READY_PROMISE = new Promise(r => { FB_READY_RESOLVE = r; });

/* ================== SECRET LOAD ================== */
async function loadSecret() {
  try {
    const res = await fetch(SECRET_URL + '?_=' + Date.now());
    if (!res.ok) throw new Error('secret.json not found');
    const j = await res.json();
    SECRET = { ...SECRET, ...j };
    console.log('✅ secret.json loaded');
    return SECRET;
  } catch (e) {
    console.warn('❌ secret.json fail:', e);
    return SECRET;
  }
}

/* ================== FIREBASE ================== */
async function initFirebase() {
  if (!SECRET.firebase || !SECRET.firebase.apiKey) {
    console.warn('⚠️ Firebase config secret.json me nahi');
    FB_READY_RESOLVE(false);
    return;
  }

  if (typeof firebase === 'undefined') {
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js');
  }

  if (firebase.apps.length === 0) {
    firebase.initializeApp(SECRET.firebase);
  }
  FB = firebase.firestore();
  FB_READY = true;
  FB_READY_RESOLVE(true);
  console.log('✅ Firebase ready');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function waitForFirebase() {
  return await FB_READY_PROMISE;
}

/* ================== TOAST ================== */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================== TOKEN / UPI ================== */
function getImgbbKey() { return SECRET.imgbb_key || null; }
function getUpi() {
  return { id: SECRET.upi_id || '', name: SECRET.upi_name || 'Dukan' };
}

/* ================== FIREBASE HELPERS ================== */
async function fbLoadAllProducts() {
  if (!FB_READY) return [];
  const snap = await FB.collection('products').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fbLoadAllUsers() {
  if (!FB_READY) return [];
  const snap = await FB.collection('users').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fbLoadAllOrders() {
  if (!FB_READY) return [];
  const snap = await FB.collection('orders').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fbGetOwner() {
  if (!FB_READY) return { id: 'owner', password: 'owner123' };
  const doc = await FB.collection('meta').doc('owner').get();
  if (!doc.exists) {
    const def = { id: 'owner', password: 'owner123' };
    await FB.collection('meta').doc('owner').set(def);
    return def;
  }
  return doc.data();
}

async function fbSaveProduct(p) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  if (!p.id) p.id = uid();
  await FB.collection('products').doc(p.id).set(p, { merge: true });
  return p;
}
async function fbDeleteProduct(id) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  await FB.collection('products').doc(id).delete();
}
async function fbSaveUser(u) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  if (!u.id) u.id = uid();
  await FB.collection('users').doc(u.id).set(u, { merge: true });
  return u;
}
async function fbSaveOrder(o) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  if (!o.id) o.id = uid();
  await FB.collection('orders').doc(o.id).set(o, { merge: true });
  return o;
}
async function fbUpdateOrder(id, patch) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  await FB.collection('orders').doc(id).set(patch, { merge: true });
}

/* ================== LOAD ================== */
async function loadData() {
  if (!FB_READY) {
    return { products: [], users: [], orders: [], owner: { id: 'owner', password: 'owner123' }, settings: {} };
  }
  const [products, users, orders, owner] = await Promise.all([
    fbLoadAllProducts(),
    fbLoadAllUsers(),
    fbLoadAllOrders(),
    fbGetOwner()
  ]);
  return { products, users, orders, owner, settings: {} };
}

async function loadCustomers() {
  if (!FB_READY) return { users: [] };
  return { users: await fbLoadAllUsers() };
}

/* ================== SAVE (individually handled) ================== */
async function saveData(data) { return true; }
async function saveCustomers(data) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  for (const u of data.users) await fbSaveUser(u);
  return true;
}

/* ================== IMAGE ================== */
async function uploadImage(file) {
  const key = getImgbbKey();
  if (!key) throw new Error('ImgBB key secret.json me nahi');
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

/* ================== BOOT ================== */
loadSecret().then(async () => {
  await initFirebase();
  console.log('BOOT:', { secret: !!SECRET.gh_token, firebase: FB_READY });
});

/* ================== SERVICE WORKER ================== */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
