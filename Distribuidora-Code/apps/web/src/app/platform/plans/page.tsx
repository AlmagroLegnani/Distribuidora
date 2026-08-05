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

interface PlanForm {
  name: string;
  slug: string;
  price: string;
  currency: string;
}

const EMPTY_FORM: PlanForm = { name: '', slug: '', price: '', currency: 'UYU' };

// Plantilla para arrancar rápido la primera vez — el operador puede editar
// nombre y precio libremente, esto es solo para no partir de un form vacío.
const STARTER_TIERS: PlanForm[] = [
  { name: 'Pequeña empresa', slug: 'pequena', price: '', currency: 'UYU' },
  { name: 'Mediana empresa', slug: 'mediana', price: '', currency: 'UYU' },
  { name: 'Gran empresa', slug: 'grande', price: '', currency: 'UYU' },
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('es-UY', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

// Un plan por tamaño de empresa (Pequeña / Mediana / Grande, o los que hagan
// falta) — cada uno con su propio monto mensual, así se le puede cotizar
// distinto a cada distribuidora según su tamaño. Al crear/reclasificar una
// distribuidora se elige cuál de estos planes le corresponde (ver
// "Nueva distribuidora" en /platform y "Cambiar plan" en su ficha).
export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null); // null = no hay form de edición abierto; 'new' = alta
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<Plan[]>('/plans');
      setPlans(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar los planes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function openNew(starter?: PlanForm) {
    setFormError('');
    setForm(starter ?? EMPTY_FORM);
    setEditingId('new');
  }

  function openEdit(plan: Plan) {
    setFormError('');
    setForm({ name: plan.name, slug: plan.slug, price: String(plan.price), currency: plan.currency });
    setEditingId(plan.id);
  }

  async function handleSave() {
    setFormError('');
    if (!form.name.trim() || !form.slug.trim() || form.price === '') {
      setFormError('Completá nombre, identificador y precio.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        slug: slugify(form.slug),
        price: Number(form.price),
        currency: form.currency.trim() || 'UYU',
        maxProducts: null,
        maxClients: null,
        maxOrdersMonth: null,
        active: true,
      };

      if (editingId && editingId !== 'new') {
        await api.put(`/plans/${editingId}`, payload);
      } else {
        await api.post('/plans', payload);
      }
      setEditingId(null);
      await fetchPlans();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el plan');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(plan: Plan) {
    try {
      await api.put(`/plans/${plan.id}`, { active: !plan.active });
      await fetchPlans();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar el plan');
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Un monto distinto según el tamaño de la distribuidora — 3 meses de prueba gratuita y
            después se paga el monto del plan que le corresponda. El uso es total y libre en
            cualquier plan (sin límites de productos, clientes ni pedidos).
          </p>
        </div>
        {editingId === null && (
          <button onClick={() => openNew()} className="btn-primary text-sm whitespace-nowrap">
            + Nuevo plan
          </button>
        )}
      </div>

      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

      {plans.length === 0 && editingId === null && (
        <div className="card p-6 text-center space-y-3">
          <p className="text-sm text-gray-500">Todavía no creaste ningún plan.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {STARTER_TIERS.map((tier) => (
              <button key={tier.slug} onClick={() => openNew(tier)} className="btn-secondary text-sm">
                + {tier.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {plans.map((plan) =>
          editingId === plan.id ? (
            <PlanFormFields
              key={plan.id}
              form={form}
              setForm={setForm}
              onSave={handleSave}
              onCancel={() => setEditingId(null)}
              saving={saving}
              error={formError}
              isNew={false}
            />
          ) : (
            <div key={plan.id} className="card p-5 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">{plan.name}</span>
                  {!plan.active && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold text-gray-900 mt-1">
                  {formatCurrency(plan.price, plan.currency)}
                  <span className="text-sm font-normal text-gray-500">/mes</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(plan)} className="btn-secondary text-xs">
                  Editar
                </button>
                <button onClick={() => toggleActive(plan)} className="text-xs text-gray-500 hover:text-gray-700">
                  {plan.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          )
        )}

        {editingId === 'new' && (
          <PlanFormFields
            form={form}
            setForm={setForm}
            onSave={handleSave}
            onCancel={() => setEditingId(null)}
            saving={saving}
            error={formError}
            isNew
          />
        )}
      </div>
    </div>
  );
}

function PlanFormFields({
  form,
  setForm,
  onSave,
  onCancel,
  saving,
  error,
  isNew,
}: {
  form: PlanForm;
  setForm: (f: PlanForm) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string;
  isNew: boolean;
}) {
  return (
    <div className="card p-5 space-y-3 border-blue-200">
      <h3 className="font-semibold text-gray-900 text-sm">{isNew ? 'Nuevo plan' : 'Editar plan'}</h3>
      {error && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Nombre</label>
          <input
            className="input"
            value={form.name}
            placeholder="Ej: Mediana empresa"
            onChange={(e) => {
              const name = e.target.value;
              setForm({ ...form, name, slug: form.slug === slugify(form.name) ? slugify(name) : form.slug });
            }}
          />
        </div>
        <div>
          <label className="label">Precio mensual</label>
          <input
            type="number"
            className="input"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Moneda</label>
          <input className="input" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Identificador interno (slug)</label>
          <input
            className="input font-mono"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">
          Cancelar
        </button>
      </div>
    </div>
  );
}
