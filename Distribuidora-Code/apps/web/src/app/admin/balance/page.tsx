'use client';

import { useEffect, useState } from 'react';
import {
  getOrderBalance,
  getClientOrderBalance,
  type OrderBalance,
  type PeriodStats,
  type ClientOrderBalance,
} from '@/lib/admin/api';
import { formatCurrency, formatDateShort } from '@/lib/admin/utils';

type Tab = 'general' | 'clientes';
type ClientSortKey = 'ordersThisMonth' | 'ordersThisWeek' | 'ordersToday' | 'ordersTotal' | 'name';

/** Verde a partir de 80% (umbral alto), azul a partir de 50% (umbral medio), gris debajo. */
function pctColor(pct: number): { text: string; bg: string; ring: string } {
  if (pct >= 80) return { text: 'text-green-700', bg: 'bg-green-50', ring: 'border-green-200' };
  if (pct >= 50) return { text: 'text-blue-700', bg: 'bg-blue-50', ring: 'border-blue-200' };
  return { text: 'text-gray-600', bg: 'bg-gray-50', ring: 'border-gray-200' };
}

function PeriodCard({ title, stats }: { title: string; stats: PeriodStats }) {
  const colors = pctColor(stats.pctClientsWithOrders);
  return (
    <div className={`card p-5 border ${colors.ring}`}>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <div className="flex items-end justify-between mt-2">
        <div>
          <p className="text-3xl font-bold text-gray-900">{stats.orders}</p>
          <p className="text-xs text-gray-500 mt-0.5">pedidos · {formatCurrency(stats.revenue)}</p>
        </div>
        <div className={`text-right px-3 py-2 rounded-xl ${colors.bg}`}>
          <p className={`text-2xl font-bold ${colors.text}`}>{stats.pctClientsWithOrders}%</p>
          <p className="text-[11px] text-gray-500">
            {stats.clientsWithOrders}/{stats.totalActiveClients} clientes
          </p>
        </div>
      </div>
    </div>
  );
}

export default function BalancePage() {
  const [tab, setTab] = useState<Tab>('general');
  const [balance, setBalance] = useState<OrderBalance | null>(null);
  const [clients, setClients] = useState<ClientOrderBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<ClientSortKey>('ordersThisMonth');

  useEffect(() => {
    Promise.all([getOrderBalance(), getClientOrderBalance()])
      .then(([b, c]) => {
        setBalance(b);
        setClients(c);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;
  }

  if (!balance) return null;

  const sortedClients = [...clients].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    return b[sortKey] - a[sortKey];
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Balance Estadístico</h2>
        <p className="text-sm text-gray-500 mt-1">
          Pedidos y % de clientes activos que pidieron, para decidir el plan de cobro.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setTab('general')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'general'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          General
        </button>
        <button
          onClick={() => setTab('clientes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'clientes'
              ? 'border-blue-600 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Por cliente
        </button>
      </div>

      {tab === 'general' ? (
        <div className="space-y-5">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              % de tus {balance.totalActiveClients} clientes activos que hicieron al menos un pedido
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <PeriodCard title="Hoy" stats={balance.day} />
              <PeriodCard title="Esta semana" stats={balance.week} />
              <PeriodCard title="Este mes" stats={balance.month} />
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> 80% o más
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 50% a 79%
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> menos de 50%
            </span>
          </div>

          <div className="card p-5">
            <p className="text-sm font-medium text-gray-500">Histórico total</p>
            <div className="flex items-end gap-6 mt-2">
              <div>
                <p className="text-3xl font-bold text-gray-900">{balance.allTime.orders}</p>
                <p className="text-xs text-gray-500 mt-0.5">pedidos totales (sin contar cancelados)</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-gray-900">{formatCurrency(balance.allTime.revenue)}</p>
                <p className="text-xs text-gray-500 mt-0.5">facturado histórico</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
            <h3 className="font-semibold text-gray-900 text-sm">Pedidos por cliente</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs text-gray-500">Ordenar por</label>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as ClientSortKey)}
                className="input py-1 text-xs w-auto"
              >
                <option value="ordersThisMonth">Pedidos este mes</option>
                <option value="ordersThisWeek">Pedidos esta semana</option>
                <option value="ordersToday">Pedidos hoy</option>
                <option value="ordersTotal">Total histórico</option>
                <option value="name">Nombre</option>
              </select>
            </div>
          </div>
          {sortedClients.length === 0 ? (
            <p className="p-5 text-sm text-gray-500">No hay clientes activos todavía.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 font-medium text-right">Hoy</th>
                    <th className="px-4 py-2 font-medium text-right">Semana</th>
                    <th className="px-4 py-2 font-medium text-right">Mes</th>
                    <th className="px-4 py-2 font-medium text-right">Histórico</th>
                    <th className="px-4 py-2 font-medium text-right">Último pedido</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sortedClients.map((c) => (
                    <tr key={c.clientId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-900">{c.name}</td>
                      <td className="px-4 py-2.5 text-right">{c.ordersToday}</td>
                      <td className="px-4 py-2.5 text-right">{c.ordersThisWeek}</td>
                      <td className="px-4 py-2.5 text-right">{c.ordersThisMonth}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{c.ordersTotal}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {c.lastOrderAt ? formatDateShort(c.lastOrderAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
