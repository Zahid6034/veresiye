/**

* BAKKAL POS — Service Worker
* ─────────────────────────────────────────────
* OFFLINE + OTOMATİK GÜNCELLEME
*
* MANTIK:
*
* 1. İnternet varsa → güncel HTML GitHub'dan alınır.
* 2. İnternet yoksa → cache'deki sürüm açılır.
* 3. Apps Script / Google Sheets istekleri cache'lenmez.
* 4. Yeni Service Worker geldiğinde eski cache otomatik silinir.
* ─────────────────────────────────────────────
  */

const CACHE_NAME = 'bakkal-pos-v2';

const CACHE_FILES = [
'./',
'./index.html',
'./manifest.json',
'https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500;600&display=swap',
'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

/* ══════════════════════════════════════════════
KURULUM
══════════════════════════════════════════════ */

self.addEventListener('install', (event) => {

event.waitUntil(

```
caches.open(CACHE_NAME)

  .then((cache) => cache.addAll(CACHE_FILES))

  // Yeni Service Worker'ı bekletmeden aktif et
  .then(() => self.skipWaiting())
```

);

});

/* ══════════════════════════════════════════════
AKTİVASYON
Eski cache'leri temizle
══════════════════════════════════════════════ */

self.addEventListener('activate', (event) => {

event.waitUntil(

```
caches.keys()

  .then((names) =>

    Promise.all(

      names

        .filter((name) => name !== CACHE_NAME)

        .map((name) => caches.delete(name))

    )

  )

  // Açık olan tüm sekmelerde yeni Service Worker'ı kullan
  .then(() => self.clients.claim())
```

);

});

/* ══════════════════════════════════════════════
İSTEK YAKALAMA
══════════════════════════════════════════════ */

self.addEventListener('fetch', (event) => {

const request = event.request;
const url = request.url;

/* ────────────────────────────────────────────
APPS SCRIPT / GOOGLE SHEETS
ASLA CACHE'LEME
──────────────────────────────────────────── */

if (
url.includes('script.google.com') ||
url.includes('docs.google.com')
) {

```
event.respondWith(

  fetch(request)

    .catch(() => {

      // Offline ise POS'un kuyruk sistemi devreye girsin
      return new Response('[]', {
        headers: {
          'Content-Type': 'application/json'
        }
      });

    })

);

return;
```

}

/* ────────────────────────────────────────────
HTML / ANA SAYFA

```
 İNTERNET VARSA:
 Önce GitHub'dan güncel sürümü al.

 İNTERNET YOKSA:
 Cache'deki sürümü kullan.
 ──────────────────────────────────────────── */
```

if (request.mode === 'navigate') {

```
event.respondWith(

  fetch(request)

    .then((response) => {

      // Güncel HTML başarıyla geldiyse cache'i güncelle
      if (
        response &&
        response.status === 200
      ) {

        const clone = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => {

            cache.put(request, clone);

          });

      }

      return response;

    })

    .catch(() => {

      // İnternet yok → cache'deki HTML'yi aç
      return caches.match('./index.html');

    })

);

return;
```

}

/* ────────────────────────────────────────────
DİĞER DOSYALAR

```
 JS / CSS / görseller vb.
 Önce cache'e bak.
 Cache'te yoksa internetten al.
 ──────────────────────────────────────────── */
```

event.respondWith(

```
caches.match(request)

  .then((cached) => {

    // Cache'te varsa kullan
    if (cached) {
      return cached;
    }


    // Cache'te yoksa internetten getir
    return fetch(request)

      .then((response) => {

        if (
          response &&
          response.status === 200
        ) {

          const clone = response.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {

              cache.put(request, clone);

            });

        }

        return response;

      });

  })

  .catch(() => {

    // Tamamen offline durumda
    if (request.mode === 'navigate') {

      return caches.match('./index.html');

    }

  })
```

);

});
