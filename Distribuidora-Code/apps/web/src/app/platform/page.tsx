'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { api } from '@/lib/platform/api';

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

interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  active: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  TRIALING: 'En prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago vencido',
  SUSPENDED: 'Suspendida',
  CANCELLED: 'Cancelada',
};

const EMPTY_CREATE_FORM = { name: '', email: '', phone: '', slug: '' };

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-UY', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(date)
  );
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Días hábiles (lunes a viernes) que faltan hasta `dateStr`. 0 si ya pasó. Espeja subscriptionService.businessDaysUntil. */
function businessDaysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = new Date(dateStr);
  end.setHours(0, 0, 0, 0);
  if (end <= now) return 0;

  let count = 0;
  const cur = new Date(now);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export default function DistributorsPage() {
  const [distributors, setDistributors] = useState<Distributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const [plan, setPlan] = useState<Plan | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createdResult, setCreatedResult] = useState<{ name: string; email: string; accessCode: string } | null>(
    null
  );

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
    // Hay un solo plan/precio para todos — lo traemos para asignarlo
    // automáticamente al crear una distribuidora, sin pedírselo al operador.
    api
      .get<Plan[]>('/plans')
      .then((data) => setPlan(data[0] ?? null))
      .catch(() => null);
  }, [fetchDistributors]);

  function openCreateForm() {
    setCreateError('');
    setCreatedResult(null);
    setCreateForm(EMPTY_CREATE_FORM);
    setShowCreateForm(true);
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError('');

    if (!plan) {
      setCreateError('Todavía no hay un plan configurado. Cargalo primero en la sección "Plan".');
      return;
    }

    setCreating(true);
    try {
      const result = await api.post<{
        distributor: { id: string; name: string; email: string; slug: string };
        accessCode: string;
      }>('/distributors', {
        name: createForm.name,
        email: createForm.email,
        phone: createForm.phone,
        slug: createForm.slug,
        planId: plan.id,
      });
      setCreatedResult({
        name: result.distributor.name,
        email: result.distributor.email,
        accessCode: result.accessCode,
      });
      await fetchDistributors();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Error al crear la distribuidora');
    } finally {
      setCreating(false);
    }
  }

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

  async function handleNotifyPaymentDue(id: string, name: string) {
    if (!confirm(`¿Avisarle a ${name} que se le acerca el vencimiento del pago?`)) return;
    setBusyId(id);
    try {
      const result = await api.post<{ message: string }>(`/distributors/${id}/notify-payment-due`, {});
      alert(`Aviso enviado. Mensaje: "${result.message}"`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al enviar el aviso');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Distribuidoras</h2>
          <p className="text-sm text-gray-500 mt-0.5">{distributors.length} tenant(s) registrados</p>
        </div>
        <button onClick={openCreateForm} className="btn-primary text-sm">
          + Nueva distribuidora
        </button>
      </div>

      {showCreateForm && (
        <div className="card p-5 space-y-4 max-w-xl">
          {createdResult ? (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-900">¡Distribuidora creada!</h3>
              <p className="text-sm text-gray-600">
                Le enviamos el código de acceso por email a <strong>{createdResult.email}</strong>. Si no
                le llega (por ejemplo en desarrollo sin SMTP configurado), pasale este código a mano:
              </p>
              <p className="text-2xl font-bold tracking-widest bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                {createdResult.accessCode}
              </p>
              <p className="text-xs text-gray-500">
                {createdResult.name} ingresa a su backoffice con su email y este código como contraseña
                inicial.
              </p>
              <div className="flex gap-2 pt-2">
                <button onClick={openCreateForm} className="btn-secondary text-sm">
                  Cargar otra
                </button>
                <button onClick={() => setShowCreateForm(false)} className="btn-primary text-sm">
                  Listo
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleCreate} className="space-y-3">
              <h3 className="font-semibold text-gray-900">Nueva distribuidora</h3>
              {createError && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{createError}</div>}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="label">Nombre del negocio</label>
                  <input
                    className="input"
                    required
                    value={createForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setCreateForm((f) => ({
                        ...f,
                        name,
                        slug: f.slug === slugify(f.name) ? slugify(name) : f.slug,
                      }));
                    }}
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    className="input"
                    required
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Teléfono</label>
                  <input
                    className="input"
                    required
                    value={createForm.phone}
                    onChange={(e) => setCreateForm({ ...createForm, phone: e.target.value })}
                    placeholder="+598 99 123 456"
                  />
                </div>
                <div>
                  <label className="label">Identificador de URL (slug)</label>
                  <input
                    className="input font-mono"
                    required
                    value={createForm.slug}
                    onChange={(e) => setCreateForm({ ...createForm, slug: slugify(e.target.value) })}
                    placeholder="distribuidora-norte"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2">
                {plan
                  ? `Se le asigna el ${plan.name} (${formatCurrency(plan.price, plan.currency)}/mes) con 90 días de prueba gratuita. El código de acceso se genera y se envía por email al crearla.`
                  : 'Todavía no hay un plan configurado — cargalo primero en la sección "Plan" del menú.'}
              </p>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={creating} className="btn-primary text-sm">
                  {creating ? 'Creando...' : 'Crear y enviar código'}
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="btn-secondary text-sm">
                  Cancelar
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      ) : (
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
                  const dueDate = sub?.currentPeriodEnd ?? sub?.trialEndsAt ?? null;
                  const daysLeft = businessDaysUntil(dueDate);
                  const dueSoon = daysLeft !== null && daysLeft <= 5;
                  return (
                    <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/platform/distributors/${d.id}`} className="font-medium text-gray-900 hover:text-blue-600">
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
                        <div>{formatDate(dueDate)}</div>
                        {dueSoon && (
                          <div className="text-xs font-medium text-amber-600 mt-0.5">
                            {daysLeft === 0
                              ? '⚠ vencido'
                              : `⚠ vence en ${daysLeft} día${daysLeft === 1 ? '' : 's'} hábil${daysLeft === 1 ? '' : 'es'}`}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-xs text-gray-500">
                        {d._count.products}p · {d._count.clients}c · {d._count.orders}pd
                      </td>
                      <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                        {sub && (
                          <button
                            onClick={() => handleNotifyPaymentDue(d.id, d.name)}
                            disabled={busyId === d.id}
                            className="text-xs text-amber-700 hover:text-amber-800 font-medium"
                          >
                            Avisar
                          </button>
                        )}
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
      )}
    </div>
  );
}
