'use client';

import { useEffect, useState, useCallback } from 'react';
import { getNotifications, markNotificationsRead, deleteNotification, sendReminder, StockAlert } from '@/lib/admin/api';
import { formatDate } from '@/lib/admin/utils';

export default function NotificationsPage() {
  const [alerts, setAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications();
      setAlerts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const unreadCount = alerts.filter((a) => !a.read).length;

  async function handleMarkAllRead() {
    setMarking(true);
    try {
      await markNotificationsRead();
      await fetchAlerts();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al marcar como leídas');
    } finally {
      setMarking(false);
    }
  }

  async function handleMarkOneRead(id: string) {
    try {
      await markNotificationsRead([id]);
      setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, read: true } : a)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al marcar como leída');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta notificación?')) return;
    setDeletingId(id);
    try {
      await deleteNotification(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar la notificación');
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendReminder(id: string) {
    setSendingId(id);
    try {
      const result = await sendReminder(id);
      if (result.sent) {
        setAlerts((prev) =>
          prev.map((a) => (a.id === id ? { ...a, reminderSentAt: new Date().toISOString() } : a))
        );
      } else {
        alert(result.reason || 'No se pudo enviar el recordatorio.');
        await fetchAlerts();
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al enviar el recordatorio');
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
          <p className="text-sm text-gray-500 mt-1">
            Avisos de stock bajo, vencimiento de pago, sugerencias de recompra y clientes que dejaron
            de pedir.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            disabled={marking}
            className="btn-secondary"
          >
            {marking ? 'Marcando...' : `Marcar todas como leídas (${unreadCount})`}
          </button>
        )}
      </div>

      <div className="card">
        {loading ? (
          <div className="p-6 text-center text-gray-500">Cargando...</div>
        ) : alerts.length === 0 ? (
          <div className="p-6 text-center text-gray-500">
            No hay notificaciones todavía. Te avisaremos acá cuando algún producto tenga menos de 30
            unidades de stock, cuando se acerque el vencimiento de tu pago, cuando detectemos que un
            cliente viene pidiendo el mismo producto seguido, o cuando un cliente habitual deje de
            pedir por un tiempo.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-500">
                <th className="p-4 font-medium">Aviso</th>
                <th className="p-4 font-medium">Fecha</th>
                <th className="p-4 font-medium">Enviado</th>
                <th className="p-4 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((alert) => (
                <tr
                  key={alert.id}
                  className={`border-b border-gray-100 last:border-0 ${
                    alert.read ? 'text-gray-500' : 'bg-amber-50 font-medium text-gray-900'
                  }`}
                >
                  <td className="p-4">
                    {alert.type === 'PAYMENT_DUE' ? (
                      <>
                        <span className="mr-1">⏰</span>
                        {alert.message}
                      </>
                    ) : alert.type === 'REORDER_SUGGESTION' ? (
                      <>
                        <span className="mr-1">🔄</span>
                        {alert.message}
                      </>
                    ) : alert.type === 'CLIENT_COOLING' ? (
                      <>
                        <span className="mr-1">🥶</span>
                        {alert.message}
                      </>
                    ) : (
                      <>
                        <span className="mr-1">⚠️</span>
                        Quedan {alert.stockAtAlert} unidades de {alert.productName}
                      </>
                    )}
                  </td>
                  <td className="p-4">{formatDate(alert.createdAt)}</td>
                  <td className="p-4">
                    {alert.type === 'REORDER_SUGGESTION'
                      ? alert.reminderSentAt
                        ? 'Recordatorio enviado'
                        : '—'
                      : alert.emailSentAt
                      ? 'Enviado'
                      : '—'}
                  </td>
                  <td className="p-4 text-right space-x-3 whitespace-nowrap">
                    {alert.type === 'REORDER_SUGGESTION' && !alert.reminderSentAt && (
                      <button
                        onClick={() => handleSendReminder(alert.id)}
                        disabled={sendingId === alert.id}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium disabled:opacity-50"
                      >
                        {sendingId === alert.id ? 'Enviando...' : 'Enviar recordatorio'}
                      </button>
                    )}
                    {!alert.read && (
                      <button
                        onClick={() => handleMarkOneRead(alert.id)}
                        className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                      >
                        Marcar como leída
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(alert.id)}
                      disabled={deletingId === alert.id}
                      className="text-red-600 hover:text-red-700 text-xs font-medium disabled:opacity-50"
                    >
                      {deletingId === alert.id ? 'Eliminando...' : 'Eliminar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
