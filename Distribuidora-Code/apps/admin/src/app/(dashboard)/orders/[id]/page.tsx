'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api, fetchOrderReceipt } from '@/lib/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_BADGE, OrderStatus } from '@/lib/utils';

interface OrderDetail {
  id: string;
  total: number;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client: {
    id: string;
    rut: string | null;
    cedula: string | null;
    name: string | null;
    email: string | null;
    phone: string | null;
  };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: { name: string; code: string | null };
  }>;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  PENDING: 'PROCESSING',
  PROCESSING: 'COMPLETED',
};

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    api
      .get<OrderDetail>(`/orders/${params.id}`)
      .then(setOrder)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function changeStatus(newStatus: OrderStatus) {
    if (!order) return;
    if (!confirm(`¿Cambiar estado a "${STATUS_LABELS[newStatus]}"?`)) return;
    setUpdating(true);
    try {
      const updated = await api.patch<OrderDetail>(`/orders/${order.id}/status`, {
        status: newStatus,
      });
      setOrder(updated);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar estado');
    } finally {
      setUpdating(false);
    }
  }

  async function handlePrintReceipt() {
    if (!order) return;
    setPrinting(true);
    try {
      const { blob, emailedTo } = await fetchOrderReceipt(order.id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      if (emailedTo) {
        alert(`Comprobante generado. También se envió por email a ${emailedTo}.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al generar el comprobante');
    } finally {
      setPrinting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
        {error || 'Pedido no encontrado'}
      </div>
    );
  }

  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Volver a pedidos
      </button>

      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Pedido #{order.id.slice(-8).toUpperCase()}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{formatDate(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${STATUS_BADGE[order.status]}`}>
              {STATUS_LABELS[order.status]}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
          {nextStatus && (
            <button
              onClick={() => changeStatus(nextStatus)}
              disabled={updating}
              className="btn-primary"
            >
              {updating ? 'Actualizando...' : `Marcar como "${STATUS_LABELS[nextStatus]}"`}
            </button>
          )}
          {order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
            <button
              onClick={() => changeStatus('CANCELLED')}
              disabled={updating}
              className="btn-danger"
            >
              Cancelar Pedido
            </button>
          )}
          <button onClick={handlePrintReceipt} disabled={printing} className="btn-secondary">
            {printing ? 'Generando...' : 'Imprimir comprobante'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Genera un comprobante de pedido en PDF (no es una factura fiscal electrónica) y, si el cliente
          tiene email registrado, se lo envía automáticamente.
        </p>
      </div>

      {/* Client Info */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Cliente</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {order.client.rut && (
            <div>
              <span className="text-gray-500">RUT:</span>
              <span className="ml-2 font-mono font-medium">{order.client.rut}</span>
            </div>
          )}
          {order.client.cedula && (
            <div>
              <span className="text-gray-500">Cédula:</span>
              <span className="ml-2 font-mono font-medium">{order.client.cedula}</span>
            </div>
          )}
          <div>
            <span className="text-gray-500">Empresa:</span>
            <span className="ml-2">{order.client.name || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Email:</span>
            <span className="ml-2">{order.client.email || '—'}</span>
          </div>
          <div>
            <span className="text-gray-500">Teléfono:</span>
            <span className="ml-2">{order.client.phone || '—'}</span>
          </div>
        </div>
        {order.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <span className="text-gray-500 text-sm">Notas: </span>
            <span className="text-sm">{order.notes}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Productos</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Cantidad</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Precio Unit.</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {order.items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium">{item.product.name}</td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {item.product.code || '—'}
                </td>
                <td className="px-4 py-3 text-center">{item.quantity}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(item.unitPrice)}</td>
                <td className="px-4 py-3 text-right font-semibold">{formatCurrency(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200">
            <tr>
              <td colSpan={4} className="px-4 py-3 text-right font-bold text-gray-900">
                TOTAL
              </td>
              <td className="px-4 py-3 text-right font-bold text-lg text-blue-700">
                {formatCurrency(order.total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
