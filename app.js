/* ================== SECRET ================== */
const SECRET_URL = './secret.json';

let SECRET = {
  imgbb_key: '',
  upi_id: '',
  upi_name: 'Dukan',
  firebase: {}
};

let FB = null;
let AUTH = null;
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
    console.warn('⚠️ Firebase config nahi');
    FB_READY_RESOLVE(false);
    return;
  }
  if (typeof firebase === 'undefined') {
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js');
  }
  if (firebase.apps.length === 0) firebase.initializeApp(SECRET.firebase);
  FB = firebase.firestore();
  AUTH = firebase.auth();
  FB_READY = true;
  FB_READY_RESOLVE(true);
  console.log('✅ Firebase ready');
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function waitForFirebase() { return await FB_READY_PROMISE; }

/* ================== AUTH HELPERS ================== */
async function ownerSignIn(email, password) {
  if (!AUTH) throw new Error('Firebase ready nahi');
  const cred = await AUTH.signInWithEmailAndPassword(email, password);
  console.log('✅ Owner signed in:', cred.user.uid);
  return cred.user;
}

async function customerSignIn() {
  if (!AUTH) throw new Error('Firebase ready nahi');
  const cur = AUTH.currentUser;
  if (cur) return cur;
  const cred = await AUTH.signInAnonymously();
  console.log('✅ Customer anonymous:', cred.user.uid);
  return cred.user;
}

function getAuthUid() {
  if (!AUTH || !AUTH.currentUser) return null;
  return AUTH.currentUser.uid;
}

async function authSignOut() {
  if (AUTH) await AUTH.signOut();
}

/* ================== TOAST ================== */
function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ================== SETTINGS ================== */
function getImgbbKey() { return SECRET.imgbb_key || null; }
function getUpi() { return { id: SECRET.upi_id || '', name: SECRET.upi_name || 'Dukan' }; }

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
async function fbLoadMyUser(uid) {
  if (!FB_READY) return null;
  const doc = await FB.collection('users').doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}
async function fbLoadAllOrders() {
  if (!FB_READY) return [];
  const snap = await FB.collection('orders').orderBy('created_at', 'desc').get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function fbLoadMyOrders(uid) {
  if (!FB_READY) return [];
  const snap = await FB.collection('orders').where('user_id', '==', uid).get();
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return arr;
}
async function fbLoadAllUdhar() {
  if (!FB_READY) return [];
  const snap = await FB.collection('udhar').get();
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return arr;
}
async function fbLoadMyUdhar(uid) {
  if (!FB_READY) return [];
  const snap = await FB.collection('udhar').where('user_id', '==', uid).get();
  const arr = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  arr.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return arr;
}

async function fbSaveProduct(p) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  if (!p.id) p.id = uid();
  await FB.collection('products').doc(p.id).set(p, { merge: true });
  return p;
}
async function fbDeleteProduct(id) {
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
  await FB.collection('orders').doc(id).set(patch, { merge: true });
}
async function fbSaveUdhar(u) {
  if (!FB_READY) throw new Error('Firebase ready nahi');
  if (!u.id) u.id = uid();
  await FB.collection('udhar').doc(u.id).set(u, { merge: true });
  return u;
}

/* ================== LOAD ================== */
async function loadData() {
  if (!FB_READY) return { products: [], users: [], orders: [], udhar: [] };
  const [products, users, orders, udhar] = await Promise.all([
    fbLoadAllProducts(), fbLoadAllUsers(), fbLoadAllOrders(), fbLoadAllUdhar()
  ]);
  return { products, users, orders, udhar };
}

async function loadMyData(uid) {
  if (!FB_READY) return { products: [], me: null, myOrders: [], myUdhar: [] };
  const [products, me, myOrders, myUdhar] = await Promise.all([
    fbLoadAllProducts(),
    fbLoadMyUser(uid),
    fbLoadMyOrders(uid),
    fbLoadMyUdhar(uid)
  ]);
  return { products, me, myOrders, myUdhar };
}

/* ================== IMAGE ================== */
async function uploadImage(file) {
  const key = getImgbbKey();
  if (!key) throw new Error('ImgBB key nahi');
  const form = new FormData(); form.append('image', file);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, { method: 'POST', body: form });
  const json = await res.json();
  if (!json.success) throw new Error('Image upload fail');
  return json.data.url;
}

/* ================== AUTH SESSION ================== */
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
async function logout() {
  await authSignOut();
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  location.replace('index.html');
}
async function logoutUser() {
  await authSignOut();
  localStorage.removeItem('role');
  localStorage.removeItem('session');
  location.replace('index.html');
}

/* ================== USER STATS ================== */
function calculateUserStats(userId, orders, udhar) {
  const myOrders = orders.filter(o => o.user_id === userId);
  const total_orders = myOrders.reduce((a, o) => a + o.total, 0);
  const total_paid = myOrders.filter(o => o.payment_status === 'paid').reduce((a, o) => a + o.total, 0);
  const order_pending = total_orders - total_paid;

  const myUdhar = (udhar || []).filter(u => u.user_id === userId && u.status !== 'paid');
  const udhar_pending = myUdhar.reduce((a, u) => a + u.amount, 0);

  return {
    total_orders, total_paid, order_pending, udhar_pending,
    total_pending: order_pending + udhar_pending,
    order_count: myOrders.length,
    udhar_count: myUdhar.length
  };
}

/* ================== PHONE ACTIONS ================== */
function callPhone(phone) { window.location.href = 'tel:' + phone; }
function whatsappPhone(phone, msg) {
  const text = encodeURIComponent(msg || 'Namaste, Dukan se');
  window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
}
function smsPhone(phone) { window.location.href = 'sms:' + phone; }

/* ================== UNITS ================== */
const UNIT_LABEL = {
  kg:'kg', gram:'g', liter:'L', ml:'ml', piece:'pc',
  packet:'pkt', box:'box', dozen:'doz', strip:'strip', bottle:'bottle'
};
const UNIT_STEP = {
  kg: 0.25, gram: 50, liter: 0.25, ml: 50,
  piece: 1, packet: 1, box: 1, dozen: 1, strip: 1, bottle: 1
};

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
    gpay: `tez://upi/pay?${base}`, phonepe: `phonepe://pay?${base}`,
    paytm: `paytmmp://pay?${base}`, bhim: `bhim://pay?${base}`,
    any: `upi://pay?${base}`
  };
}

/* ================== BOOT ================== */
loadSecret().then(async () => {
  await initFirebase();
  console.log('BOOT:', { secret: !!SECRET.imgbb_key, firebase: FB_READY });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js').catch(() => {}));
}
