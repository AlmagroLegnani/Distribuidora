'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/admin/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_BADGE, OrderStatus } from '@/lib/admin/utils';

interface Order {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  notes: string | null;
  client: { rut: string | null; cedula: string | null; name: string | null; email: string | null };
  items: Array<{ product: { name: string } }>;
}

const ALL_STATUSES: Array<{ value: string; label: string }> = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'PROCESSING', label: 'En Proceso' },
  { value: 'COMPLETED', label: 'Completado' },
  { value: 'CANCELLED', label: 'Cancelado' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterRut, setFilterRut] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set('status', filterStatus);
      if (filterRut) params.set('documento', filterRut);
      if (filterFrom) params.set('dateFrom', filterFrom);
      if (filterTo) params.set('dateTo', filterTo);
      const data = await api.get<Order[]>(`/orders?${params.toString()}`);
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterRut, filterFrom, filterTo]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Pedidos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{orders.length} pedido(s)</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Estado</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              {ALL_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">RUT o Cédula</label>
            <input
              type="text"
              value={filterRut}
              onChange={(e) => setFilterRut(e.target.value)}
              placeholder="21-123456-0019"
              className="input"
            />
          </div>
          <div>
            <label className="label">Desde</label>
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              className="input"
            />
          </div>
          <div>
            <label className="label">Hasta</label>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              className="input"
            />
          </div>
        </div>
        <button
          onClick={() => {
            setFilterStatus('');
            setFilterRut('');
            setFilterFrom('');
            setFilterTo('');
          }}
          className="btn-secondary mt-3 text-xs"
        >
          Limpiar filtros
        </button>
      </div>

      {/* Loading / vacío */}
      {loading ? (
        <div className="card flex items-center justify-center h-48">
          <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : orders.length === 0 ? (
        <div className="card text-center py-12 text-gray-500">
          <p className="text-lg">No se encontraron pedidos</p>
          <p className="text-sm mt-1">Intenta cambiar los filtros</p>
        </div>
      ) : (
        <>
          {/* Tarjetas — mobile. La tabla de 8 columnas no entra en una pantalla
              chica y obligaba a un scroll horizontal incómodo, así que acá
              mostramos lo mismo apilado en tarjetas. */}
          <div className="lg:hidden space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/admin/orders/${order.id}`}
                className="card block p-4 space-y-2 active:bg-gray-50"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-mono text-xs font-semibold text-gray-500">
                      #{order.id.slice(-8).toUpperCase()}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{formatDate(order.createdAt)}</div>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${STATUS_BADGE[order.status]}`}>
                    {STATUS_LABELS[order.status]}
                  </span>
                </div>
                <div className="text-sm text-gray-900 font-medium">{order.client.name || '—'}</div>
                <div className="text-xs font-mono text-gray-500">
                  {order.client.rut || order.client.cedula}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                  <span className="text-xs text-gray-500">{order.items.length} ítem(s)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(order.total)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* Tabla — desktop */}
          <div className="hidden lg:block card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Pedido</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">RUT/Cédula</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Razón Social</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">Productos</th>
                    <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs font-semibold text-gray-500">
                        #{order.id.slice(-8).toUpperCase()}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(order.createdAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">
                        {order.client.rut || order.client.cedula}
                      </td>
                      <td className="px-4 py-3 text-gray-900">{order.client.name || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {order.items.length} ítem(s)
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">
                        {formatCurrency(order.total)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_BADGE[order.status]}`}>
                          {STATUS_LABELS[order.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                        >
                          Ver →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
