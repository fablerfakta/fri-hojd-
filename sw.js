// Fri höjd – enkel offline-cache för appens egna filer (kartbilderna kräver nät)
const CACHE = 'frihojd-v2';
const FILER = ['./', 'index.html', 'style.css', 'app.js', 'vikt.js', 'data/hinder.json', 'data/bk.json', 'manifest.webmanifest', 'icon.svg'];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILER)).then(() => self.skipWaiting())));
self.addEventListener('activate', (e) => e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n !== CACHE).map((n) => caches.delete(n)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Nät först, cache som reserv – så att ny data slår igenom direkt
  e.respondWith(fetch(e.request).then((svar) => {
    const kopia = svar.clone();
    caches.open(CACHE).then((c) => c.put(e.request, kopia));
    return svar;
  }).catch(() => caches.match(e.request)));
});
