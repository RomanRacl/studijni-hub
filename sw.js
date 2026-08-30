// Service Worker pro Studijní Hub.
//
// DŮLEŽITÉ: prohlížeče z bezpečnostních důvodů nepovolují service workery na
// adresách typu file:// (tedy když appku otevřeš prostým dvojklikem na .html
// soubor). Aby tento soubor začal fungovat a appka byla instalovatelná a plně
// dostupná offline, je potřeba všechny čtyři soubory (studijni-hub.html,
// manifest.json, icon-192.png, icon-512.png, sw.js) nahrát na jakýkoliv
// webový hosting (i ten nejjednodušší, např. GitHub Pages, Netlify, nebo
// lokální server přes "python3 -m http.server" ve stejné složce) a appku
// otevřít přes http:// nebo https:// (u lokálního serveru i http://localhost
// funguje). Bez toho appka funguje úplně stejně jako dřív, jen si knihovny
// (Tailwind, Vue, font) stahuje z internetu při každém prvním načtení.

const CACHE_NAME = 'studijni-hub-cache-v2';

// Soubory, které si service worker při instalaci rovnou uloží do cache,
// aby appka po prvním navštívení fungovala i bez připojení k internetu.
const CORE_ASSETS = [
  './',
  './studijni-hub.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/vue@3/dist/vue.global.prod.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch((err) => console.warn('Nepodařilo se předehřát cache při instalaci SW:', err))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Strategie "network-first, fallback na cache" pro vlastní HTML (aby se po
// nasazení nové verze appka aktualizovala co nejdřív), a "cache-first,
// aktualizace na pozadí" pro externí knihovny (Vue, Tailwind, font) - ty se
// mění zřídka, takže je výhodnější je servírovat okamžitě z cache a jen si
// je na pozadí obnovit pro příště.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isAppShell = req.url.includes('studijni-hub.html') || req.url.endsWith('/');

  if (isAppShell) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && (res.status === 200 || res.type === 'opaque')) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
