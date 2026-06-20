/**
 * BAKKAL POS — Service Worker
 * ─────────────────────────────────────────────
 * Bu dosya uygulamayı tamamen OFFLINE çalıştırır.
 *
 * MANTIK:
 * 1. İlk açılış (internetli) → tüm dosyalar cihaza indirilir/cache'lenir
 * 2. Sonraki açılışlar → internet olsa da olmasa da CACHE'TEN açılır
 * 3. Apps Script (Sheets sync) istekleri cache'lenmez — onlar
 *    her zaman gerçek ağ bağlantısı dener, yoksa POS'taki kuyruk
 *    sistemi devreye girer (final.html içinde zaten var)
 * ─────────────────────────────────────────────
 */

const CACHE_NAME = 'bakkal-pos-v1';
const CACHE_FILES = [
  './',
  './index.html',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// ── KURULUM: dosyaları cache'e indir ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CACHE_FILES))
      .then(() => self.skipWaiting())
  );
});

// ── AKTİVASYON: eski cache'leri temizle ──
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME)
             .map((name) => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

// ── İSTEK YAKALAMA: cache-first stratejisi ──
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Apps Script / Google Sheets istekleri ASLA cache'lenmez
  // Bunlar her zaman gerçek ağ üzerinden gider (veya kuyrukta bekler)
  if (url.includes('script.google.com') || url.includes('docs.google.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Offline ise boş cevap döndür, POS'taki kuyruk sistemi
        // bu hatayı yakalayıp işlemi bekletecek
        return new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // Diğer her şey: önce cache'e bak, yoksa ağdan çek, ağdan da çekilirse cache'e ekle
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Geçerli bir cevapsa cache'e kopyala
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Tamamen offline ve cache'te de yoksa — sadece ana sayfa için fallback
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
