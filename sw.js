/* Bingo musical — service worker
   Red primero con 3 s de límite; si el servidor no responde (p. ej. bloqueo de Cloudflare)
   se sirve la copia guardada. Solo toca archivos de esta web y la fuente; Spotify va directo. */
const VERSION = 'v4';
const CACHE = 'bingo30-' + VERSION;
const FILES = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('bingo30-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function withTimeout(p, ms) {
  return new Promise((ok, ko) => { const t = setTimeout(() => ko(new Error('timeout')), ms); p.then(r => { clearTimeout(t); ok(r); }, e => { clearTimeout(t); ko(e); }); });
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Fuente de Google: se guarda la primera vez y luego sale de la copia
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(r => { c.put(req, r.clone()); return r; }))));
    return;
  }
  if (url.origin !== self.location.origin) return; // Spotify y demás: sin tocar

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const r = await withTimeout(fetch(req), 3000);
      if (r.ok) cache.put(req.mode === 'navigate' ? './' : req, r.clone());
      return r;
    } catch (err) {
      const hit = req.mode === 'navigate'
        ? (await cache.match('./')) || (await cache.match('./index.html'))
        : await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;
      throw err;
    }
  })());
});
