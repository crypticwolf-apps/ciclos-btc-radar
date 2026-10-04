// =============================================================================
// Service worker: que la app abra sin conexión y arranque rápido, sin quedarse
// nunca con una versión vieja.
//
//   · /assets/* (JS y CSS con hash en el nombre): primero la caché. Un fichero
//     con hash no cambia jamás; si cambia el código, cambia el nombre.
//   · Navegación (el HTML): primero la red, y se guarda copia; esa copia solo
//     se usa sin conexión.
//   · Iconos y manifiesto (sin hash): la copia guardada al instante y, por
//     detrás, la de la red para la próxima vez. Antes se servían de caché para
//     siempre: un icono nuevo no llegaba nunca a quien ya tenía la app.
//   · /api/*: nunca pasa por aquí. Los datos son del momento o no son.
//
// Los /assets/ se recortan a los más recientes: antes cada despliegue dejaba
// los ficheros de la versión anterior guardados para siempre y el almacenamiento
// del móvil crecía con cada actualización.
//
// Al subir CACHE_NAME, `activate` borra las cachés anteriores.
// =============================================================================
const CACHE_NAME = 'ciclos-btc-shell-v4';
const APP_SHELL = ['/', '/manifest.webmanifest', '/btc.svg', '/icon-192.png'];
/** Ficheros con hash que se conservan: de sobra para una versión completa. */
const MAX_ASSETS = 40;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

/** Deja solo los MAX_ASSETS ficheros con hash más recientes. */
async function trimAssets(cache) {
  const keys = (await cache.keys()).filter((r) => new URL(r.url).pathname.startsWith('/assets/'));
  // `keys()` devuelve por orden de inserción: los primeros son los más viejos.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_ASSETS)).map((r) => cache.delete(r)));
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // La copia para abrir sin conexión se renueva con cada visita. Antes
          // era la de la instalación y apuntaba a ficheros de una versión vieja
          // ya borrados: sin conexión, la app se quedaba en blanco.
          if (response.ok && url.pathname === '/') {
            const copy = response.clone();
            event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put('/', copy)));
          }
          return response;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          // Nunca se guarda una página HTML como si fuera código: si el fichero
          // ya no existe, el servidor puede responder con la página de la app.
          const html = (response.headers.get('content-type') || '').includes('text/html');
          if (response.ok && !html) {
            const copy = response.clone();
            event.waitUntil(
              caches.open(CACHE_NAME).then(async (cache) => {
                await cache.put(request, copy);
                await trimAssets(cache);
              }),
            );
          }
          return response;
        });
      }),
    );
    return;
  }

  // Resto de ficheros estáticos: copia guardada al instante, y se renueva por
  // detrás para la próxima visita.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response.ok) void cache.put(request, response.clone());
          return response;
        })
        .catch(() => cached ?? Response.error());
      if (cached) {
        event.waitUntil(network);
        return cached;
      }
      return network;
    }),
  );
});

// --- Alertas (Web Push) -------------------------------------------------------
// El servidor manda { title, body, tag, url }. `tag` hace que un aviso nuevo del
// mismo tipo sustituya al anterior en vez de apilarse.
self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    msg = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Ciclos BTC Radar', {
      body: msg.body || '',
      tag: msg.tag || 'ciclos',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: msg.url || '/' },
    }),
  );
});

// Al tocar el aviso: se enfoca la app si ya está abierta y, si no, se abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const win = wins.find((w) => new URL(w.url).origin === self.location.origin);
      if (win) return win.navigate(url).then((w) => (w || win).focus());
      return self.clients.openWindow(url);
    }),
  );
});
