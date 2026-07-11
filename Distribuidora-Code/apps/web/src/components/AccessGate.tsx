'use client';

import { useEffect, useState, FormEvent } from 'react';
import { verifyAccessCode } from '@/lib/api';
import { loadAccess, saveAccess } from '@/lib/access';

interface Props {
  slug: string;
  distributorName: string;
  children: React.ReactNode;
}

export default function AccessGate({ slug, distributorName, children }: Props) {
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [rut, setRut] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const stored = loadAccess(slug);
    if (stored) setUnlocked(true);
    setChecking(false);
  }, [slug]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!rut.trim() || !code.trim()) {
      setError('Ingresa tu RUT y el código de acceso.');
      return;
    }
    setSubmitting(true);
    try {
      await verifyAccessCode(slug, code.trim(), rut.trim());
      saveAccess(slug, { rut: rut.trim(), code: code.trim() });
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (unlocked) {
    return <>{children}</>;
  }

  return (
    <div className="max-w-sm mx-auto py-12">
      <div className="card p-6 space-y-4">
        <div className="text-center">
          <h2 className="text-lg font-bold text-gray-900">Acceso a {distributorName}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Ingresa tu RUT y el código que te entregó tu distribuidora para ver el catálogo.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="label">RUT</label>
            <input
              type="text"
              value={rut}
              onChange={(e) => setRut(e.target.value)}
              placeholder="12.345.678-9"
              className="input"
              autoFocus
            />
          </div>
          <div>
            <label className="label">Código de acceso</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Ej: NORTE2024"
              className="input font-mono"
            />
          </div>

          {error && (
            <div className="text-sm p-2 rounded bg-red-50 text-red-700">{error}</div>
          )}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? 'Verificando...' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
