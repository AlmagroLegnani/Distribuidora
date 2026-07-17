'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { getClientOrders, type ClientOrder } from '@/lib/api';
import { loadAccess } from '@/lib/access';
import { formatCurrency } from '@/lib/cart';

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En Proceso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  PROCESSING: 'bg-blue-100 text-blue-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function MyOrdersPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [orders, setOrders] = useState<ClientOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    const access = loadAccess(slug);
    if (!access) {
      setError('No pudimos identificarte. Vuelve a ingresar tu RUT o Cédula y código.');
      setLoading(false);
      return;
    }
    try {
      const data = await getClientOrders(slug, access.documento, access.code);
      setOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar tus pedidos');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const backLink = (
    <Link
      href={`/${slug}`}
      className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      Volver al catálogo
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-5">
        {backLink}
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-5">
        {backLink}
        <div className="text-center py-16 text-sm text-red-600">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {backLink}

      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mis Pedidos</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Seguimiento del estado de tus pedidos realizados.
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium">Todavía no tienes pedidos.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const isOpen = expanded === order.id;
            return (
              <div key={order.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpanded(isOpen ? null : order.id)}
                  className="w-full flex items-center justify-between gap-4 p-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs font-semibold text-gray-500">
                      #{order.id.slice(-8).toUpperCase()}
                    </span>
                    <span className="text-sm text-gray-600">{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.total)}
                    </span>
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                        STATUS_STYLES[order.status] || 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {STATUS_LABELS[order.status] || order.status}
                    </span>
                    <svg
                      className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t border-gray-100 p-4 space-y-2">
                    {order.notes && (
                      <p className="text-xs text-gray-500 italic">Nota: {order.notes}</p>
                    )}
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-gray-500 text-xs">
                          <th className="text-left font-medium pb-2">Producto</th>
                          <th className="text-center font-medium pb-2">Cant.</th>
                          <th className="text-right font-medium pb-2">Precio</th>
                          <th className="text-right font-medium pb-2">Subtotal</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {order.items.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 text-gray-900">
                              {item.product.name}
                              {item.product.code && (
                                <span className="text-gray-400 font-mono text-xs ml-1">
                                  ({item.product.code})
                                </span>
                              )}
                            </td>
                            <td className="py-2 text-center text-gray-600">{item.quantity}</td>
                            <td className="py-2 text-right text-gray-600">
                              {formatCurrency(item.unitPrice)}
                            </td>
                            <td className="py-2 text-right font-medium text-gray-900">
                              {formatCurrency(item.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
