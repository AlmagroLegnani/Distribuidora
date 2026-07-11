'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  maxProducts: number | null;
  maxClients: number | null;
  maxOrdersMonth: number | null;
  active: boolean;
}

const emptyForm = {
  name: '',
  slug: '',
  price: 0,
  currency: 'CLP',
  maxProducts: '' as string | number,
  maxClients: '' as string | number,
  maxOrdersMonth: '' as string | number,
  active: true,
};

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Plan[]>('/plans');
      setPlans(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function startCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      slug: plan.slug,
      price: plan.price,
      currency: plan.currency,
      maxProducts: plan.maxProducts ?? '',
      maxClients: plan.maxClients ?? '',
      maxOrdersMonth: plan.maxOrdersMonth ?? '',
      active: plan.active,
    });
    setShowForm(true);
  }

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        price: Number(form.price),
        currency: form.currency,
        maxProducts: form.maxProducts === '' ? null : Number(form.maxProducts),
        maxClients: form.maxClients === '' ? null : Number(form.maxClients),
        maxOrdersMonth: form.maxOrdersMonth === '' ? null : Number(form.maxOrdersMonth),
        active: form.active,
      };

      if (editingId) {
        await api.put(`/plans/${editingId}`, payload);
      } else {
        await api.post('/plans', payload);
      }
      setShowForm(false);
      await fetchPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planes</h2>
          <p className="text-sm text-gray-500 mt-0.5">Planes comerciales ofrecidos a las distribuidoras</p>
        </div>
        <button onClick={startCreate} className="btn-primary text-sm">
          + Nuevo plan
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-3">
          <h3 className="font-semibold text-gray-900">{editingId ? 'Editar plan' : 'Nuevo plan'}</h3>
          {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Nombre</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Slug</label>
              <input
                className="input font-mono"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                placeholder="pro"
              />
            </div>
            <div>
              <label className="label">Precio mensual (CLP)</label>
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
            <div>
              <label className="label">Máx. productos (vacío = ilimitado)</label>
              <input
                type="number"
                className="input"
                value={form.maxProducts}
                onChange={(e) => setForm({ ...form, maxProducts: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Máx. clientes</label>
              <input
                type="number"
                className="input"
                value={form.maxClients}
                onChange={(e) => setForm({ ...form, maxClients: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Máx. pedidos/mes</label>
              <input
                type="number"
                className="input"
                value={form.maxOrdersMonth}
                onChange={(e) => setForm({ ...form, maxOrdersMonth: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) => setForm({ ...form, active: e.target.checked })}
              />
              <label className="text-sm text-gray-700">Visible en el signup público</label>
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSave} disabled={saving} className="btn-primary text-sm">
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
            <button onClick={() => setShowForm(false)} className="btn-secondary text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Plan</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Límites</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Visible</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {plans.map((plan) => (
                <tr key={plan.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{plan.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{plan.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {new Intl.NumberFormat('es-CL', {
                      style: 'currency',
                      currency: plan.currency,
                      minimumFractionDigits: 0,
                    }).format(plan.price)}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-500">
                    {plan.maxProducts ?? '∞'}p · {plan.maxClients ?? '∞'}c · {plan.maxOrdersMonth ?? '∞'}pd/mes
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        plan.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {plan.active ? 'Sí' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => startEdit(plan)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
              {plans.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    No hay planes creados todavía.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
