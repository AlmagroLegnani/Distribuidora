'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, STATUS_LABELS, STATUS_BADGE, OrderStatus } from '@/lib/utils';

interface Order {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  notes: string | null;
  client: { rut: string; name: string | null; email: string | null };
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
      if (filterRut) params.set('rut', filterRut);
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
            <label className="label">RUT Cliente</label>
            <input
              type="text"
              value={filterRut}
              onChange={(e) => setFilterRut(e.target.value)}
              placeholder="12.345.678-9"
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

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg">No se encontraron pedidos</p>
            <p className="text-sm mt-1">Intenta cambiar los filtros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Pedido</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">RUT</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Empresa</th>
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
                    <td className="px-4 py-3 font-mono text-gray-700">{order.client.rut}</td>
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
                        href={`/orders/${order.id}`}
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
        )}
      </div>
    </div>
  );
}
