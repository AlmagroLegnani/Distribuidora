'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/platform/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  active: boolean;
}

const emptyForm = {
  name: 'Plan TuStockApp',
  slug: 'unico',
  price: 0,
  currency: 'UYU',
};

// Un solo plan/precio para todas las distribuidoras — no hay niveles ni
// tiers, y mientras paguen el uso es totalmente libre (sin límites de
// productos, clientes ni pedidos). Esta pantalla edita ese único plan
// (o lo crea la primera vez).
export default function PlanPage() {
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Plan[]>('/plans');
      const current = data[0] ?? null;
      setPlan(current);
      if (current) {
        setForm({
          name: current.name,
          slug: current.slug,
          price: current.price,
          currency: current.currency,
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  async function handleSave() {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        price: Number(form.price),
        currency: form.currency,
        // Sin límites: mientras paguen la mensualidad, el uso es total y libre.
        maxProducts: null,
        maxClients: null,
        maxOrdersMonth: null,
        active: true,
      };

      if (plan) {
        await api.put(`/plans/${plan.id}`, payload);
      } else {
        await api.post('/plans', payload);
      }
      setSaved(true);
      await fetchPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Plan</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Un solo precio para todas las distribuidoras: 3 meses de prueba gratuita y después se paga
          este monto por mes. Mientras estén al día con el pago, el uso es total y libre — sin límites
          de productos, clientes ni pedidos.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 items-start">
        {/* Plan actual — lo que está guardado ahora mismo, no lo que hay tipeado sin guardar */}
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 text-sm">Plan actual</h3>
          {plan ? (
            <>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {new Intl.NumberFormat('es-UY', {
                    style: 'currency',
                    currency: plan.currency,
                    minimumFractionDigits: 0,
                  }).format(plan.price)}
                  <span className="text-sm font-normal text-gray-500">/mes</span>
                </div>
                <div className="text-sm text-gray-600 mt-1">{plan.name}</div>
              </div>
              <p className="text-xs text-gray-400">
                Esto es lo que le toca pagar, mes a mes, a todas las distribuidoras (después de sus 3
                meses de prueba gratuita).
              </p>
            </>
          ) : (
            <p className="text-sm text-gray-500">Todavía no creaste el plan. Completá el formulario y guardalo.</p>
          )}
        </div>

        {/* Editar */}
        <div className="card p-5 space-y-3">
          {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
          {saved && !error && (
            <div className="p-2 bg-green-50 text-green-700 text-sm rounded">Guardado.</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Precio mensual</label>
              <input
                type="number"
                className="input"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="label">Moneda</label>
              <input
                className="input"
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
              />
            </div>
          </div>
          <div className="pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : plan ? 'Guardar cambios' : 'Crear plan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
