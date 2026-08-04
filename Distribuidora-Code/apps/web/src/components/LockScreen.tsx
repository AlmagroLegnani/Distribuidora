'use client';

import { FormEvent, useState } from 'react';

interface Props {
  visible: boolean;
  title: string;
  subtitle?: string;
  label: string;
  /** Debe devolver true si la clave/código es correcto, false si no. Puede tirar para errores de red/servidor. */
  onSubmit: (value: string) => Promise<boolean>;
}

/**
 * Pantalla de bloqueo genérica: fondo nublado/transparente que tapa todo el
 * panel y un box centrado para reingresar la clave. Se usa tanto para
 * distribuidoras (contraseña) como para clientes (código de acceso) — ver
 * useIdleTimer para el disparador (inactividad o botón manual).
 */
export default function LockScreen({ visible, title, subtitle, label, onSubmit }: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!visible) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      const ok = await onSubmit(value.trim());
      if (!ok) {
        setError('Incorrecto. Probá de nuevo.');
        setValue('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo verificar, probá de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-md">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl p-6 space-y-4 border border-gray-100"
      >
        <div className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-3">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>

        <div>
          <label className="label">{label}</label>
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="input"
          />
        </div>

        {error && <div className="text-sm p-2 rounded bg-red-50 text-red-700">{error}</div>}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Verificando...' : 'Desbloquear'}
        </button>
      </form>
    </div>
  );
}
