'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { verifyAccessCode, Distributor } from '@/lib/api';
import { loadAccess, saveAccess } from '@/lib/access';
import PortalHeader from './PortalHeader';
import PortalHeaderMinimal from './PortalHeaderMinimal';
import PushNotificationPrompt from './PushNotificationPrompt';

interface Props {
  slug: string;
  distributor: Distributor;
  children: React.ReactNode;
}

export default function AccessGate({ slug, distributor, children }: Props) {
  const distributorName = distributor.name;
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [documento, setDocumento] = useState('');
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
    if (!documento.trim() || !code.trim()) {
      setError('Ingresa tu RUT o Cédula y el código de acceso.');
      return;
    }
    setSubmitting(true);
    try {
      const result = await verifyAccessCode(slug, code.trim(), documento.trim());
      saveAccess(slug, {
        documento: documento.trim(),
        code: code.trim(),
        clientName: result.clientName,
      });
      setUnlocked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código inválido');
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeaderMinimal distributor={distributor} slug={slug} />
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  if (unlocked) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PortalHeader distributor={distributor} slug={slug} />
        <main className="max-w-6xl mx-auto px-4 py-6 pb-20 sm:pb-6">
          <PushNotificationPrompt slug={slug} />
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PortalHeaderMinimal distributor={distributor} slug={slug} />
      <main className="max-w-6xl mx-auto px-4 py-6">
        <div className="max-w-sm mx-auto py-12">
          <Link
            href="/distribuidoras"
            className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver a distribuidoras
          </Link>
          <div className="card p-6 space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-gray-900">Acceso a {distributorName}</h2>
              <p className="text-sm text-gray-500 mt-1">
                Ingresa tu RUT o Cédula y el código que te entregó tu distribuidora para ver el catálogo.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="label">RUT o Cédula</label>
                <input
                  type="text"
                  value={documento}
                  onChange={(e) => setDocumento(e.target.value)}
                  placeholder="211234560019 ó 12345678"
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
      </main>
    </div>
  );
}
