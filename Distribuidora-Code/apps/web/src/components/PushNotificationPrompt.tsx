'use client';

import { useEffect, useState } from 'react';
import { subscribeToPush } from '@/lib/api';
import { loadAccess } from '@/lib/access';

interface Props {
  slug: string;
}

function dismissedKey(slug: string): string {
  return `push_prompt_dismissed_${slug}`;
}

// El navegador espera la VAPID public key como Uint8Array, no como el string
// base64url que nos da process.env — esta conversión es la estándar
// recomendada por la doc de Web Push (no hay forma de pasarle el string tal cual).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Banner discreto que le ofrece al cliente (ya logueado con RUT/Cédula +
 * código) activar el recordatorio diario de "hacé tu pedido". Solo se
 * muestra si el navegador soporta Push, todavía no se decidió el permiso
 * (default) y el cliente no lo cerró antes en este dispositivo.
 */
export default function PushNotificationPrompt({ slug }: Props) {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidKey) return; // no configurado del lado del servidor todavía
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (typeof Notification === 'undefined') return;
    if (Notification.permission !== 'default') return;
    if (localStorage.getItem(dismissedKey(slug)) === '1') return;

    setVisible(true);
  }, [slug]);

  async function handleEnable() {
    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const access = loadAccess(slug);
    if (!vapidKey || !access) return;

    setLoading(true);
    setError('');
    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setVisible(false);
        localStorage.setItem(dismissedKey(slug), '1');
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        // TS's lib.dom typings for BufferSource don't line up cleanly with a
        // freshly-constructed Uint8Array across TS/lib versions — the browser
        // API itself accepts it fine, so we cast through unknown here.
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as unknown as BufferSource,
      });

      await subscribeToPush(slug, access.documento, access.code, subscription.toJSON() as {
        endpoint: string;
        keys: { p256dh: string; auth: string };
      });

      setVisible(false);
    } catch {
      setError('No pudimos activar las notificaciones. Probá de nuevo más tarde.');
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(dismissedKey(slug), '1');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="card p-4 mb-4 flex items-start gap-3 bg-blue-50 border-blue-100">
      <span className="text-xl">🔔</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">¿Querés que te avisemos para no olvidarte?</p>
        <p className="text-xs text-gray-500 mt-0.5">
          Te mandamos un recordatorio por día si todavía no hiciste tu pedido.
        </p>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        <div className="flex gap-2 mt-2">
          <button onClick={handleEnable} disabled={loading} className="btn-primary text-xs px-3 py-1.5">
            {loading ? 'Activando...' : 'Activar recordatorio'}
          </button>
          <button onClick={handleDismiss} className="btn-secondary text-xs px-3 py-1.5">
            Ahora no
          </button>
        </div>
      </div>
    </div>
  );
}
