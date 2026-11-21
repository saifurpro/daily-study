/* ══════════════════════════════════════
   SERVICE WORKER — লিখিত প্রস্তুতি
   GitHub Pages: https://saifurpro.github.io/daily-study/

   কাজ:
   ১. প্রথমবার লোড হলে HTML cache করে রাখে
   ২. cache থাকলে সাথে সাথে cache থেকে খোলে (ডাটা অন কিন্তু MB নেই — তবুও আটকাবে না)
   ৩. ইন্টারনেট থাকলে পেছনে নতুন কপি এনে cache আপডেট করে (পরের বার খোলার সময় নতুনটা দেখা যায়)
   ৪. cache-এ নেই এমন ফাইলের জন্য সর্বোচ্চ ৪ সেকেন্ড নেটের অপেক্ষা
   ৫. Apps Script / Drive request সরাসরি নেটওয়ার্কে পাঠায়
══════════════════════════════════════ */

const CACHE_NAME = 'likhito-prostuti-v3';
const NET_TIMEOUT = 4000;

const PRECACHE_URLS = [
  '/daily-study/',
  '/daily-study/index.html',
  '/daily-study/icon-192.png',
  '/daily-study/icon-512.png',
];

/* ── INSTALL ── (একটা ফাইল না থাকলেও বাকিগুলো cache হবে) */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await Promise.all(PRECACHE_URLS.map(u =>
      cache.add(new Request(u, {cache: 'reload'})).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function fetchWithTimeout(req, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(req).then(
      r => { clearTimeout(timer); resolve(r); },
      e => { clearTimeout(timer); reject(e); }
    );
  });
}

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = req.url;

  // Apps Script ও Drive — cache করো না, সরাসরি নেটওয়ার্কে
  if (
    url.includes('script.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('googleapis.com')
  ) {
    return; // browser নিজে handle করবে
  }

  // শুধু নিজের সাইটের ফাইল
  if (new URL(url).origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const isNav = req.mode === 'navigate';

    let cached = await cache.match(req, {ignoreSearch: true});
    if (!cached && isNav) {
      cached = (await cache.match('/daily-study/index.html')) || (await cache.match('/daily-study/'));
    }

    // পেছনে নতুন কপি আনা — আটকে গেলেও ইউজার টের পাবে না
    const refresh = fetch(req).then(res => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    }).catch(() => null);

    if (cached) {
      event.waitUntil(refresh);
      return cached;
    }

    // cache-এ নেই: সীমিত সময় নেটের জন্য অপেক্ষা
    try {
      const res = await fetchWithTimeout(req, NET_TIMEOUT);
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    } catch (e) {
      return new Response('', {status: 504, statusText: 'Offline'});
    }
  })());
});
