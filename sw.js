/* ══════════════════════════════════════
   SERVICE WORKER — দৈনিক পড়া
   GitHub Pages: https://saifurpro.github.io/daily-study/
   
   কাজ:
   ১. প্রথমবার লোড হলে HTML cache করে রাখে
   ২. ইন্টারনেট থাকলে নেটওয়ার্ক থেকে লোড করে + cache আপডেট করে
   ৩. ইন্টারনেট না থাকলে cache থেকে দেয়
   ৪. Apps Script / Drive request সরাসরি নেটওয়ার্কে পাঠায়
══════════════════════════════════════ */

const CACHE_NAME = 'daily-study-v1';
const SCOPE = '/daily-study/';

// Cache করার ফাইলগুলো
const PRECACHE_URLS = [
  '/daily-study/',
  '/daily-study/index.html',
  '/daily-study/icon-192.png',
  '/daily-study/icon-512.png',
];

/* ── INSTALL ── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE ── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;

  // Apps Script ও Drive — cache করো না, সরাসরি নেটওয়ার্কে
  if (
    url.includes('script.google.com') ||
    url.includes('drive.google.com') ||
    url.includes('googleapis.com')
  ) {
    return; // browser নিজে handle করবে
  }

  event.respondWith(
    fetch(event.request)
      .then(networkResp => {
        // নেটওয়ার্ক সফল — cache আপডেট করো
        if (networkResp.ok) {
          const clone = networkResp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResp;
      })
      .catch(() => {
        // নেটওয়ার্ক নেই — cache থেকে দাও
        return caches.match(event.request)
          .then(cached => {
            if (cached) return cached;
            // যেকোনো navigate request-এ index.html দাও
            if (event.request.mode === 'navigate') {
              return caches.match('/daily-study/index.html');
            }
          });
      })
  );
});
