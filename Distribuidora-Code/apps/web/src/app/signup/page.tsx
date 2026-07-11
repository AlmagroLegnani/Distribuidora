'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getSignupPlans, getSignupCategories, signupDistributor } from '@/lib/api';

export default function SignupPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<string[]>([]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    slug: '',
    phone: '',
    planId: '',
    categories: [] as string[],
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getSignupPlans()
      .then((data) => {
        if (data.length > 0) setForm((f) => ({ ...f, planId: data[0].id }));
      })
      .catch(() => setError('No se pudieron cargar los planes disponibles.'));

    getSignupCategories()
      .then(setCategories)
      .catch(() => setError('No se pudieron cargar los rubros disponibles.'));
  }, []);

  function toggleCategory(category: string) {
    setForm((f) => ({
      ...f,
      categories: f.categories.includes(category)
        ? f.categories.filter((c) => c !== category)
        : [...f.categories, category],
    }));
  }

  function slugify(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!form.planId) {
      setError('Selecciona un plan.');
      return;
    }
    if (form.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    if (form.categories.length === 0) {
      setError('Selecciona al menos un rubro.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await signupDistributor({
        name: form.name,
        email: form.email,
        password: form.password,
        slug: form.slug,
        phone: form.phone || undefined,
        planId: form.planId,
        categories: form.categories,
      });

      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
      } else {
        router.push(`/signup/success?slug=${result.distributor.slug}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar tu distribuidora');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Registra tu distribuidora</h1>
          <p className="text-gray-500 mt-2">
            Empieza gratis con una prueba de 7 días. Sin tarjeta obligatoria para comenzar.
          </p>
        </div>

        <div className="card p-6 space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre de tu negocio</label>
              <input
                className="input"
                required
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm((f) => ({ ...f, name, slug: f.slug === slugify(f.name) ? slugify(name) : f.slug }));
                }}
              />
            </div>

            <div>
              <label className="label">Identificador de URL (slug)</label>
              <input
                className="input font-mono"
                required
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                placeholder="distribuidora-norte"
              />
              <p className="text-xs text-gray-400 mt-1">Tu catálogo quedará en /{form.slug || 'tu-slug'}</p>
            </div>

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                className="input"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Teléfono (opcional)</label>
              <input
                className="input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>

            <div>
              <label className="label">Rubros (podés elegir varios)</label>
              <div className="grid grid-cols-2 gap-2">
                {categories.map((category) => (
                  <label
                    key={category}
                    className={`flex items-center gap-2 border rounded-xl p-2.5 text-sm cursor-pointer transition-colors ${
                      form.categories.includes(category) ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.categories.includes(category)}
                      onChange={() => toggleCategory(category)}
                    />
                    {category}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="label">Contraseña</label>
              <input
                type="password"
                className="input"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? 'Creando cuenta...' : 'Empezar prueba gratis'}
            </button>

            <p className="text-center text-xs text-gray-400">
              ¿Ya tienes cuenta?{' '}
              <a href="http://localhost:3002/login" className="text-blue-600 hover:text-blue-700">
                Inicia sesión en tu backoffice
              </a>
            </p>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al inicio
          </Link>
        </p>
      </div>
    </div>
  );
}
