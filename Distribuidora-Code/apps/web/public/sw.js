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
