'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';

interface Distributor {
  id: string;
  name: string;
  email: string;
  slug: string;
  active: boolean;
  createdAt: string;
  subscription: {
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
    plan: { name: string; price: number; currency: string };
  } | null;
  _count: { products: number; clients: number; orders: number };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  TRIALING: 'En prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago vencido',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
};

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(date)
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const fetchDistributors = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Distributor[]>('/distributors');
      setDistributors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar distribuidoras');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDistributors();
  }, [fetchDistributors]);

  async function handleSuspend(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/distributors/${id}/suspend`);
      await fetchDistributors();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al suspender');
    } finally {
      setBusyId(null);
    }
  }

  async function handleActivate(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/distributors/${id}/activate`);
      await fetchDistributors();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al activar');
    } finally {
      setBusyId(null);
    }
  }

  async function handleMarkPaid(id: string) {
    if (!confirm('¿Registrar el pago de este período como recibido (transferencia/efectivo)?')) return;
    setBusyId(id);
    try {
      await api.post(`/distributors/${id}/mark-paid`, {});
      await fetchDistributors();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al registrar el pago');
    } finally {
      setBusyId(null);
    }
  }

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

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Distribuidoras</h2>
        <p className="text-sm text-gray-500 mt-0.5">{distributors.length} tenant(s) registrados</p>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Distribuidora</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Vence</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Uso</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {distributors.map((d) => {
                const sub = d.subscription;
                const statusKey = (sub?.status || 'sin_plan').toLowerCase();
                return (
                  <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link href={`/distributors/${d.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {d.name}
                      </Link>
                      <div className="text-xs text-gray-400">{d.email} · /{d.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {sub ? `${sub.plan.name} — ${formatCurrency(sub.plan.price, sub.plan.currency)}/mes` : 'Sin plan'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full badge-${statusKey}`}>
                        {sub ? STATUS_LABELS[sub.status] || sub.status : 'Manual'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {formatDate(sub?.currentPeriodEnd ?? sub?.trialEndsAt ?? null)}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {d._count.products}p · {d._count.clients}c · {d._count.orders}pd
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {sub && (
                        <button
                          onClick={() => handleMarkPaid(d.id)}
                          disabled={busyId === d.id}
                          className="text-xs text-green-700 hover:text-green-800 font-medium"
                        >
                          Marcar pagado
                        </button>
                      )}
                      {d.active ? (
                        <button
                          onClick={() => handleSuspend(d.id)}
                          disabled={busyId === d.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Suspender
                        </button>
                      ) : (
                        <button
                          onClick={() => handleActivate(d.id)}
                          disabled={busyId === d.id}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Activar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {distributors.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    Todavía no hay distribuidoras registradas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
