/* Les icônes sont servies depuis le cache en priorité : tant que ce nom ne
   change pas, un téléphone qui a déjà installé l'app continue de servir les
   anciennes. Il faut donc le bousculer à CHAQUE changement d'icône. */
const CACHE = 'catmap-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks =>
    Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const networkFirst = e.request.mode === 'navigate' || e.request.destination === 'document'
    || url.pathname === '/' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/manifest.json');

  if (networkFirst) {
    e.respondWith(
      fetch(e.request.url, { cache: 'no-store' }).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }))
  );
});
