'use client';

import { useEffect } from 'react';

// El tipado de lib.dom no incluye todavía la Badging API (setAppBadge /
// clearAppBadge) en todas las versiones de TS, así que la tipamos a mano acá.
type NavigatorWithBadge = Navigator & {
  clearAppBadge?: () => Promise<void>;
};

/** Le pide al navegador que borre el numerito rojo del ícono de la PWA
 * instalada (Badging API). Se llama tanto al entrar a la app como cada vez
 * que la pestaña/app vuelve a primer plano — si no, el badge de "1 sin leer"
 * se queda pegado en el ícono aunque el cliente ya haya visto la promoción o
 * el recordatorio que lo generó. Falla en silencio en navegadores que no
 * soportan la API (ej. Safari/iOS todavía tiene soporte parcial). */
function clearBadge(): void {
  const nav = navigator as NavigatorWithBadge;
  nav.clearAppBadge?.().catch(() => {});
}

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

  useEffect(() => {
    if (typeof navigator === 'undefined' || !('clearAppBadge' in navigator)) return;

    clearBadge();

    function handleVisibility(): void {
      if (document.visibilityState === 'visible') clearBadge();
    }
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  return null;
}
