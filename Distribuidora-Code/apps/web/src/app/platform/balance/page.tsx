'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getPlatformOrderBalance,
  type PlatformOrderBalance,
  type PeriodStats,
  type DistributorBalanceRow,
} from '@/lib/platform/api';

type SortKey = 'month' | 'week' | 'day' | 'name';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Verde a partir de 80% (umbral alto), azul a partir de 50% (umbral medio), gris debajo. */
function pctColor(pct: number): { text: string; bg: string; ring: string } {
  if (pct >= 80) return { text: 'text-green-700', bg: 'bg-green-50', ring: 'border-green-200' };
  if (pct >= 50) return { text: 'text-blue-700', bg: 'bg-blue-50', ring: 'border-blue-200' };
  return { text: 'text-gray-600', bg: 'bg-gray-50', ring: 'border-gray-200' };
}

function TotalsCard({ title, stats }: { title: string; stats: PeriodStats }) {
  const colors = pctColor(stats.pctClientsWithOrders);
  return (
    <div className={`bg-white rounded-xl p-5 border ${colors.ring}`}>
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

function PctBadge({ pct }: { pct: number }) {
  const colors = pctColor(pct);
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${colors.bg} ${colors.text}`}>
      {pct}%
    </span>
  );
}

export default function PlatformBalancePage() {
  const [data, setData] = useState<PlatformOrderBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('month');

  useEffect(() => {
    getPlatformOrderBalance()
      .then(setData)
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

  if (!data) return null;

  const sorted = [...data.distributors].sort((a, b) => {
    if (sortKey === 'name') return a.name.localeCompare(b.name);
    return b[sortKey].pctClientsWithOrders - a[sortKey].pctClientsWithOrders;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Balance Estadístico</h2>
        <p className="text-sm text-gray-500 mt-1">
          Pedidos y % de clientes activos que pidieron, por distribuidora — para decidir el plan de
          cobro de cada una ({data.totalDistributors} distribuidoras en total).
        </p>
      </div>

      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Totales de toda la plataforma
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <TotalsCard title="Hoy" stats={data.totals.day} />
          <TotalsCard title="Esta semana" stats={data.totals.week} />
          <TotalsCard title="Este mes" stats={data.totals.month} />
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> 80% o más de sus clientes pidió
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> 50% a 79%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-400" /> menos de 50%
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-gray-900 text-sm">Por distribuidora</h3>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">Ordenar por % de</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="border border-gray-200 rounded-lg px-2 py-1 text-xs"
            >
              <option value="month">Este mes</option>
              <option value="week">Esta semana</option>
              <option value="day">Hoy</option>
              <option value="name">Nombre (A-Z)</option>
            </select>
          </div>
        </div>
        {sorted.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">No hay distribuidoras todavía.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-4 py-2 font-medium">Distribuidora</th>
                  <th className="px-4 py-2 font-medium">Plan</th>
                  <th className="px-4 py-2 font-medium text-right">Clientes activos</th>
                  <th className="px-4 py-2 font-medium text-right">% hoy</th>
                  <th className="px-4 py-2 font-medium text-right">% semana</th>
                  <th className="px-4 py-2 font-medium text-right">% mes</th>
                  <th className="px-4 py-2 font-medium text-right">Pedidos mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((d: DistributorBalanceRow) => (
                  <tr key={d.distributorId} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/platform/distributors/${d.distributorId}`}
                        className="font-medium text-gray-900 hover:text-blue-700"
                      >
                        {d.name}
                      </Link>
                      {!d.active && (
                        <span className="ml-2 text-[10px] font-semibold text-red-700 bg-red-50 px-1.5 py-0.5 rounded-full">
                          Suspendida
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-gray-500">{d.planName ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right">{d.totalActiveClients}</td>
                    <td className="px-4 py-2.5 text-right">
                      <PctBadge pct={d.day.pctClientsWithOrders} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <PctBadge pct={d.week.pctClientsWithOrders} />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <PctBadge pct={d.month.pctClientsWithOrders} />
                    </td>
                    <td className="px-4 py-2.5 text-right text-gray-500">{d.month.orders}</td>
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
