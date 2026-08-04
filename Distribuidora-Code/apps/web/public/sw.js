// Service worker deliberadamente mínimo: solo existe para que la PWA sea
// instalable (Chrome/Android piden un service worker con un handler de
// "fetch" para mostrar el prompt de instalación). A propósito NO cachea
// nada — ni el catálogo, ni stock, ni pedidos, ni pantallas de login/pagos —
// para no arriesgar mostrar datos desactualizados o sensibles offline.
// Si en el futuro se agrega cacheo real, debe excluir explícitamente
// /api/*, /admin/*, /platform/*, /login, /platform-login y /[slug]/cart.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Passthrough total: cada request va directo a la red, sin cache alguno.
self.addEventListener('fetch', () => {
  // No-op a propósito — no interceptamos ni respondemos nada nosotros,
  // dejamos que el browser maneje el request normalmente.
});

// Recordatorio diario de pedido (ver reminderService.ts en la API). El
// payload llega como JSON: { title, body, url }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = data.title || 'StockApp';
  const options = {
    body: data.body || 'No olvides hacer tu pedido.',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Al tocar la notificación, abrimos (o enfocamos) el catálogo de esa distribuidora.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.openWindow(url));
});
