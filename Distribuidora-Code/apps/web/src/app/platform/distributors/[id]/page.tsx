'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/platform/api';

interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: string;
  method: string;
  paidAt: string;
}

interface DistributorDetail {
  id: string;
  name: string;
  email: string;
  slug: string;
  phone: string | null;
  active: boolean;
  // Igual que en la lista: una vez que la distribuidora eligió su propia
  // contraseña, ya puede recuperarla ella misma desde /login, así que se
  // oculta el botón de "Reenviar acceso".
  passwordChanged: boolean;
  createdAt: string;
  subscription:
    | {
        status: string;
        currentPeriodEnd: string | null;
        trialEndsAt: string | null;
        plan: { name: string; price: number; currency: string };
        payments: Payment[];
      }
    | null;
  _count: { products: number; clients: number; orders: number };
}

function formatDate(date: string | null): string {
  if (!date) return '—';
  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

function formatCurrency(amount: number, currency = 'UYU'): string {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

export default function DistributorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [distributor, setDistributor] = useState<DistributorDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<DistributorDetail>(`/distributors/${id}`);
      setDistributor(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar la distribuidora');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  async function handleSuspend() {
    setBusy(true);
    try {
      await api.patch(`/distributors/${id}/suspend`);
      await fetchDetail();
    } finally {
      setBusy(false);
    }
  }

  async function handleActivate() {
    setBusy(true);
    try {
      await api.patch(`/distributors/${id}/activate`);
      await fetchDetail();
    } finally {
      setBusy(false);
    }
  }

  async function handleMarkPaid() {
    if (!confirm('¿Registrar el pago de este período como recibido?')) return;
    setBusy(true);
    try {
      await api.post(`/distributors/${id}/mark-paid`, {});
      await fetchDetail();
    } finally {
      setBusy(false);
    }
  }

  async function handleResendAccess() {
    if (
      !distributor ||
      !confirm(
        `¿Enviarle a ${distributor.name} un link por email para crear una contraseña nueva? Esto sirve si perdió el código de acceso original.`
      )
    )
      return;
    setBusy(true);
    try {
      const result = await api.post<{ email: string }>(`/distributors/${id}/resend-access`, {});
      alert(`Listo, le enviamos un link para crear su contraseña a ${result.email}.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al reenviar el acceso');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !distributor) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>;
  }

  const sub = distributor.subscription;

  return (
    <div className="space-y-5 max-w-3xl">
      {/* Antes volvía a '/' (raíz de apps/superadmin). En la app unificada la
          lista de distribuidoras vive en /platform. */}
      <button onClick={() => router.push('/platform')} className="text-sm text-gray-500 hover:text-gray-700">
        ← Volver
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{distributor.name}</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {distributor.email} · /{distributor.slug} {distributor.phone && `· ${distributor.phone}`}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2.5 py-1 rounded-full ${
            distributor.active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
          }`}
        >
          {distributor.active ? 'Activa' : 'Suspendida'}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{distributor._count.products}</div>
          <div className="text-xs text-gray-500">Productos</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{distributor._count.clients}</div>
          <div className="text-xs text-gray-500">Clientes</div>
        </div>
        <div className="card p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{distributor._count.orders}</div>
          <div className="text-xs text-gray-500">Pedidos</div>
        </div>
      </div>

      {sub ? (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">Suscripción</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Plan</div>
              <div className="font-medium text-gray-900">
                {sub.plan.name} — {formatCurrency(sub.plan.price, sub.plan.currency)}/mes
              </div>
            </div>
            <div>
              <div className="text-gray-500">Estado</div>
              <div className="font-medium text-gray-900">{sub.status}</div>
            </div>
            <div>
              <div className="text-gray-500">Fin de período / prueba</div>
              <div className="font-medium text-gray-900">
                {formatDate(sub.currentPeriodEnd ?? sub.trialEndsAt)}
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={handleMarkPaid} disabled={busy} className="btn-secondary text-xs">
              Marcar pagado
            </button>
            {distributor.active ? (
              <button onClick={handleSuspend} disabled={busy} className="btn-danger text-xs">
                Suspender
              </button>
            ) : (
              <button onClick={handleActivate} disabled={busy} className="btn-primary text-xs">
                Activar
              </button>
            )}
          </div>

          <div className="pt-3">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">Historial de pagos</h4>
            {sub.payments.length === 0 ? (
              <p className="text-sm text-gray-500">Todavía no hay pagos registrados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500">
                    <th className="text-left font-medium pb-2">Fecha</th>
                    <th className="text-left font-medium pb-2">Método</th>
                    <th className="text-left font-medium pb-2">Estado</th>
                    <th className="text-right font-medium pb-2">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {sub.payments.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2 text-gray-600">{formatDate(p.paidAt)}</td>
                      <td className="py-2 text-gray-600 capitalize">{p.method}</td>
                      <td className="py-2 text-gray-600 capitalize">{p.status}</td>
                      <td className="py-2 text-right font-medium text-gray-900">
                        {formatCurrency(p.amount, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="card p-5 text-sm text-gray-500">
          Esta distribuidora fue provisionada manualmente y no tiene un plan/suscripción asociado.
          Su acceso se controla directamente con los botones de abajo.
          <div className="flex gap-2 pt-3">
            {distributor.active ? (
              <button onClick={handleSuspend} disabled={busy} className="btn-danger text-xs">
                Suspender
              </button>
            ) : (
              <button onClick={handleActivate} disabled={busy} className="btn-primary text-xs">
                Activar
              </button>
            )}
          </div>
        </div>
      )}

      {distributor.passwordChanged ? (
        <div className="card p-5 space-y-1">
          <h3 className="font-semibold text-gray-900">Acceso</h3>
          <p className="text-sm text-gray-500">
            Esta distribuidora ya eligió su propia contraseña. Si la olvida, puede recuperarla ella
            misma desde "¿Olvidaste tu contraseña?" en la pantalla de inicio de sesión.
          </p>
        </div>
      ) : (
        <div className="card p-5 space-y-2">
          <h3 className="font-semibold text-gray-900">Acceso</h3>
          <p className="text-sm text-gray-500">
            Todavía no eligió su propia contraseña (sigue usando el código de acceso original). Si lo
            perdió, reenviale un link para crear una nueva.
          </p>
          <button onClick={handleResendAccess} disabled={busy} className="btn-secondary text-xs">
            Reenviar acceso
          </button>
        </div>
      )}

      {/* Antes apuntaba a http://localhost:3002 (apps/admin en su propio puerto).
          En la app unificada el login del distribuidor vive en /login, mismo origen. */}
      <Link href="/login" target="_blank" className="text-xs text-blue-600 hover:text-blue-700">
        Abrir backoffice del distribuidor →
      </Link>
    </div>
  );
}
