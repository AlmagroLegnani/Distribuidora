'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { createContactRequest } from '@/lib/api';

export default function ContactoPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim() || !phone.trim()) {
      setError('Ingresa al menos tu email y tu celular.');
      return;
    }

    setSubmitting(true);
    try {
      await createContactRequest({
        name: name.trim() || undefined,
        email: email.trim(),
        phone: phone.trim(),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo enviar tu solicitud. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al inicio
          </Link>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-gray-900">¡Listo, recibimos tu solicitud!</h1>
              <p className="text-sm text-gray-500">
                Nos vamos a contactar a la brevedad para darte de alta como distribuidora en StockApp.
              </p>
              <Link href="/" className="btn-primary inline-flex mt-2">
                Volver al inicio
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold text-gray-900">Contactate con nosotros</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Dejanos tus datos y te contactamos para dar de alta a tu distribuidora en StockApp.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label">Nombre</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nombre y apellido"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="tu@email.com"
                    required
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Celular</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+598 99 123 456"
                    required
                    className="input"
                  />
                </div>

                {error && (
                  <div className="text-sm p-2 rounded bg-red-50 text-red-700">{error}</div>
                )}

                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center py-2.5">
                  {submitting ? 'Enviando...' : 'Enviar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
