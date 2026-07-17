'use client';

import { useEffect, useState } from 'react';
import { getUnreadNotifications, markNotificationsRead, StockAlert } from '@/lib/api';

/**
 * Se monta una sola vez en el layout del panel (apps/admin/src/app/(dashboard)/layout.tsx),
 * así que se dispara "al ingresar al panel": la primera vez que el layout arma el árbol
 * después de loguearse, no en cada navegación entre páginas del backoffice.
 */
export default function LowStockModal() {
  const [alerts, setAlerts] = useState<StockAlert[] | null>(null);
  const [dismissing, setDismissing] = useState(false);

  useEffect(() => {
    getUnreadNotifications()
      .then((data) => {
        if (data.length > 0) setAlerts(data);
      })
      .catch(() => null);
  }, []);

  if (!alerts || alerts.length === 0) return null;

  async function handleClose() {
    setDismissing(true);
    try {
      await markNotificationsRead(alerts!.map((a) => a.id));
      window.dispatchEvent(new Event('stockalerts:read'));
    } catch {
      // Si falla el marcado, igual cerramos el modal — se volverá a mostrar en el próximo ingreso.
    } finally {
      setDismissing(false);
      setAlerts(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
            <span className="text-xl">🔔</span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Tenés avisos nuevos</h2>
            <p className="text-sm text-gray-500">
              {alerts.length === 1 ? '1 notificación sin leer' : `${alerts.length} notificaciones sin leer`}
            </p>
          </div>
        </div>

        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-100 border border-gray-100 rounded-lg">
          {alerts.map((alert) => (
            <li key={alert.id} className="p-3 text-sm">
              {alert.type === 'PAYMENT_DUE' ? (
                <>
                  <span className="mr-1">⏰</span>
                  {alert.message}
                </>
              ) : (
                <>
                  <span className="mr-1">⚠️</span>
                  Te quedan <strong>{alert.stockAtAlert}</strong> unidades de{' '}
                  <strong>{alert.productName}</strong>.
                </>
              )}
            </li>
          ))}
        </ul>

        <button onClick={handleClose} disabled={dismissing} className="btn-primary w-full justify-center">
          {dismissing ? 'Cerrando...' : 'Entendido'}
        </button>
      </div>
    </div>
  );
}
