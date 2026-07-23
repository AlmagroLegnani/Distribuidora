'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker (public/sw.js) para que la PWA sea instalable.
 * El SW en sí no cachea nada (ver public/sw.js) — esto es solo el registro.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Si falla el registro (ej. navegador viejo, http sin TLS en prod),
      // la app sigue funcionando normal, simplemente no será instalable.
    });
  }, []);

  return null;
}
