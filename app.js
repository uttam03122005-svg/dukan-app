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
  try {
    await AUTH.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
  } catch (e) { console.warn('Persistence fail:', e); }
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

function getAuthUid() {
  if (!AUTH || !AUTH.currentUser) return null;
  return AUTH.currentUser.uid;
}

function waitForAuth() {
  return new Promise(resolve => {
    if (!AUTH) { resolve(null); return; }
    if (AUTH.currentUser) { resolve(AUTH.currentUser.uid); return; }
    let done = false;
    const unsub = AUTH.onAuthStateChanged(user => {
      if (done) return;
      done = true;
      try { unsub(); } catch (e) {}
      resolve(user ? user.uid : null);
    });
    setTimeout(() => {
      if (!done) {
        done = true;
        try { unsub(); } catch (e) {}
        resolve(AUTH.currentUser ? AUTH.currentUser.uid : null);
      }
    }, 5000);
  });
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
  t._tm = setTimeout(() => t.classList.remove('show'), 3000);
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

/* ================== IMAGE UPLOAD ================== */
async function uploadImage(file) {
  const key = getImgbbKey();
  if (!key) throw new Error('ImgBB key nahi');
  
  console.log('📤 Uploading to ImgBB...', file.size, 'bytes');
  
  const form = new FormData();
  form.append('image', file);
  
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: form
  });
  
  const json = await res.json();
  console.log('📥 ImgBB response:', json);
  
  if (!json.success) {
    throw new Error('Image upload fail: ' + (json.error?.message || 'Unknown'));
  }
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

/* ================== NOTIFICATIONS (Universal) ================== */
let MESSAGING = null;
let FCM_TOKEN = null;

// Detect PWA mode
function isPWA() {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
}

// Detect WebView
function isWebView() {
  const ua = navigator.userAgent || '';
  return /wv|WebView|Android.*Version\/[\d.]+/.test(ua) && /Android/.test(ua);
}

async function initMessaging() {
  console.log('🔔 initMessaging start');
  console.log('Mode:', { PWA: isPWA(), WebView: isWebView(), HTTPS: location.protocol === 'https:' });
  
  if (!FB_READY || !AUTH) throw new Error('Firebase ready nahi');
  if (!('Notification' in window)) throw new Error('Browser notifications support nahi karta');
  if (!('serviceWorker' in navigator)) throw new Error('Service Worker support nahi (HTTPS zaroori)');
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
    throw new Error('HTTPS zaroori hai. HTTP par notifications kaam nahi karti.');
  }

  // Request permission
  console.log('🔔 Requesting permission...');
  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  console.log('🔔 Permission:', permission);
  
  if (permission !== 'granted') {
    throw new Error('Permission denied. Settings me allow karo.');
  }

  // Load FCM SDK
  if (typeof firebase.messaging === 'undefined') {
    console.log('📦 Loading FCM SDK...');
    await loadScript('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');
  }
  
  MESSAGING = firebase.messaging();
  console.log('✅ MESSAGING init');

  const vapidKey = SECRET.firebase?.vapidKey || '';
  if (!vapidKey) throw new Error('VAPID key missing in secret.json');
  console.log('🔑 VAPID length:', vapidKey.length);

  // Register SW and wait
  console.log('📝 Registering SW...');
  const reg = await navigator.serviceWorker.register('./service-worker.js', { scope: './' });
  console.log('✅ SW registered');
  await navigator.serviceWorker.ready;
  console.log('✅ SW ready');

  // Get token
  console.log('🎫 Getting FCM token...');
  try {
    FCM_TOKEN = await MESSAGING.getToken({
      vapidKey: vapidKey,
      serviceWorkerRegistration: reg
    });
  } catch (tokenErr) {
    console.warn('Token with SW failed, trying without:', tokenErr);
    FCM_TOKEN = await MESSAGING.getToken({ vapidKey: vapidKey });
  }
  
  if (!FCM_TOKEN) throw new Error('FCM token nahi mila. VAPID key / Firebase config check karo.');
  console.log('✅ FCM Token:', FCM_TOKEN.substring(0, 30) + '...');

  // Foreground
  MESSAGING.onMessage(payload => {
    console.log('📨 Foreground:', payload);
    const title = payload.notification?.title || 'Dukan Order';
    const body = payload.notification?.body || 'Naya order aaya hai!';
    showLocalNotification(title, body, payload.data);
  });

  return FCM_TOKEN;
}

function showLocalNotification(title, body, data) {
  if (Notification.permission !== 'granted') return;
  const options = {
    body: body,
    icon: './icon-192.png',
    badge: './icon-192.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: (data && data.order_id) || 'order-' + Date.now(),
    renotify: true,
    requireInteraction: true,
    data: data || {}
  };
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready.then(reg => reg.showNotification(title, options));
  } else {
    try { new Notification(title, options); } catch (e) {}
  }
}

async function saveFCMToken(uid, token) {
  if (!uid || !token || !FB_READY) return;
  try {
    await FB.collection('users').doc(uid).set(
      { fcm_token: token, fcm_updated: new Date().toISOString(), is_pwa: isPWA() },
      { merge: true }
    );
    await FB.collection('settings').doc('owner').set(
      { fcm_token: token, fcm_updated: new Date().toISOString(), owner_uid: uid, is_pwa: isPWA() },
      { merge: true }
    );
    console.log('✅ FCM token saved');
  } catch (e) { console.warn('Save FCM fail:', e); }
}

async function setupOwnerNotifications() {
  const uid = getAuthUid();
  if (!uid) throw new Error('Login nahi hai');
  const token = await initMessaging();
  if (token) await saveFCMToken(uid, token);
  return token;
}

async function sendOrderNotificationToOwner(order) {
  if (!FB_READY || !FB) return;
  try {
    await FB.collection('notifications').add({
      type: 'new_order',
      order_id: order.id,
      user_name: order.user_name,
      user_phone: order.user_phone,
      total: order.total,
      items_count: order.items.length,
      payment_mode: order.payment_mode,
      created_at: new Date().toISOString(),
      sent: false
    });
    console.log('📨 Notification request saved');
  } catch (e) { console.warn('Order notif error:', e); }
}

/* ================== BOOT ================== */
loadSecret().then(async () => {
  await initFirebase();
  console.log('BOOT:', { secret: !!SECRET.imgbb_key, firebase: FB_READY });
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js', { scope: './' }).catch(e => {
      console.warn('SW register fail:', e);
    });
  });
}
