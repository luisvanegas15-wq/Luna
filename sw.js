// Luna · LV Studio — funciona sin internet (versión 3, compatible con iPhone)
const CACHE = 'luna-v3';
const ARCHIVOS = ['./', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

// Safari no acepta respuestas "redirigidas" desde el service worker: las limpiamos
async function limpia(r) {
  if (!r || !r.redirected) return r;
  const cuerpo = await r.blob();
  return new Response(cuerpo, { status: 200, statusText: 'OK', headers: r.headers });
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const url of ARCHIVOS) {
      try { const r = await fetch(url, { cache: 'reload' }); if (r.ok) await c.put(url, await limpia(r)); } catch (err) {}
    }
  })());
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return; // lo externo va directo a internet
  if (req.mode === 'navigate') {
    // Página: primero internet; si no hay, la copia guardada
    e.respondWith((async () => {
      try {
        const r = await limpia(await fetch(req.url, { cache: 'no-store' }));
        if (r.ok) { const c = await caches.open(CACHE); c.put('./', r.clone()); }
        return r;
      } catch (err) {
        const g = await caches.match('./');
        return g ? await limpia(g) : Response.error();
      }
    })());
    return;
  }
  // Íconos y demás: copia guardada o internet
  e.respondWith((async () => {
    const g = await caches.match(req);
    if (g) return await limpia(g);
    try { return await fetch(req); } catch (err) { return Response.error(); }
  })());
});
