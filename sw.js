// Service Worker pro Studijní Hub.
//
// DŮLEŽITÉ: prohlížeče z bezpečnostních důvodů nepovolují service workery na
// adresách typu file:// (tedy když appku otevřeš prostým dvojklikem na .html
// soubor). Aby tento soubor začal fungovat a appka byla instalovatelná a plně
// dostupná offline, je potřeba všechny soubory (studijni-hub.html,
// manifest.json, icon-192.png, icon-512.png, hero-video.mp4, hero-poster.jpg,
// tailwind-play-cdn.js, vue.global.prod.js, sw.js a celou složku katex/ se
// všemi jejími soubory) nahrát se zachováním stejné struktury složek
// pohromadě na jakýkoliv webový hosting (i ten nejjednodušší, např. GitHub
// Pages, Netlify, nebo lokální server přes "python3 -m http.server" ve
// stejné složce) a appku otevřít přes http:// nebo https:// (u lokálního
// serveru i http://localhost funguje). Bez toho appka funguje úplně stejně
// jako dřív, jen bez offline režimu a bez možnosti instalace na plochu.
//
// Tailwind a Vue jsou od teď součástí appky (tailwind-play-cdn.js,
// vue.global.prod.js) místo stahování z cdn.tailwindcss.com/cdn.jsdelivr.net
// při každém spuštění - to se na mobilních sítích (Wi-Fi/VPN/adblock) umělo
// zablokovat a appka se pak vůbec nespustila, i když na počítači fungovala
// bez problémů. Jediné, co se pořád stahuje z internetu, je font (Google
// Fonts) - a ten není kritický, appka bez něj jen použije náhradní písmo.

const CACHE_NAME = 'studijni-hub-cache-v7';

// Soubory, které si service worker při instalaci rovnou uloží do cache,
// aby appka po prvním navštívení fungovala i bez připojení k internetu.
// hero-video.mp4 a hero-poster.jpg jsou samostatné soubory (ne vložené jako
// base64 v HTML/JS) - viz komentář u <video> v šabloně.
// katex/* (css, js a woff2 fonty) - samostatně hostovaný KaTeX pro matematické
// vzorce v zápiscích, stejný důvod jako u tailwind-play-cdn.js/vue.global.prod.js
// výše: appka nesmí při startu záviset na žádném externím CDN.
const CORE_ASSETS = [
  './',
  './studijni-hub.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './hero-video.mp4',
  './hero-poster.jpg',
  './tailwind-play-cdn.js',
  './vue.global.prod.js',
  './katex/katex.min.css',
  './katex/katex.min.js',
  './katex/fonts/KaTeX_AMS-Regular.woff2',
  './katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  './katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  './katex/fonts/KaTeX_Fraktur-Bold.woff2',
  './katex/fonts/KaTeX_Fraktur-Regular.woff2',
  './katex/fonts/KaTeX_Main-Bold.woff2',
  './katex/fonts/KaTeX_Main-BoldItalic.woff2',
  './katex/fonts/KaTeX_Main-Italic.woff2',
  './katex/fonts/KaTeX_Main-Regular.woff2',
  './katex/fonts/KaTeX_Math-BoldItalic.woff2',
  './katex/fonts/KaTeX_Math-Italic.woff2',
  './katex/fonts/KaTeX_SansSerif-Bold.woff2',
  './katex/fonts/KaTeX_SansSerif-Italic.woff2',
  './katex/fonts/KaTeX_SansSerif-Regular.woff2',
  './katex/fonts/KaTeX_Script-Regular.woff2',
  './katex/fonts/KaTeX_Size1-Regular.woff2',
  './katex/fonts/KaTeX_Size2-Regular.woff2',
  './katex/fonts/KaTeX_Size3-Regular.woff2',
  './katex/fonts/KaTeX_Size4-Regular.woff2',
  './katex/fonts/KaTeX_Typewriter-Regular.woff2',
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

// Strategie "network-first, fallback na cache" pro VŠECHNY soubory appky
// (HTML, Tailwind, Vue, manifest) - aby se po nahrání nové verze na hosting
// appka aktualizovala hned při dalším načtení, ne až se "sama od sebe"
// rozhodne obnovit cache na pozadí.
//
// DŮLEŽITÉ - tohle byla skutečná příčina toho, že se opravy dlouho vůbec
// neprojevovaly na reálném telefonu, i když nové soubory už dávno ležely na
// GitHubu: dřív měly Tailwind/Vue strategii "cache-first" (rovnou z cache,
// aktualizace až na pozadí pro příště) - jakmile telefon jednou (třeba před
// týdny) úspěšně stáhl a uložil vue.global.prod.js, každé další otevření
// appky dostalo OKAMŽITĚ tu starou uloženou verzi, bez ohledu na to, co nové
// mezitím přibylo na GitHubu - a nová verze se v cache vyměnila až tiše na
// pozadí, kdy si toho nikdo nevšiml. Teprve network-first u úplně všeho tohle
// definitivně řeší: appka se vždycky nejdřív pokusí stáhnout čerstvou verzi,
// a jen když se to nepovede (offline), použije to, co má uložené z minula.
//
// Cache-first (rovnou z uloženého, bez čekání na síť) zůstává jen u velkých
// binárních souborů, které se prakticky nikdy nemění (video, obrázky) - tam
// dává smysl upřednostnit rychlost před okamžitou aktualizací.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isLargeStaticAsset = /\.(mp4|jpg|jpeg|png|webp)$/i.test(req.url);

  if (isLargeStaticAsset) {
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
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.status === 200 || res.type === 'opaque')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
