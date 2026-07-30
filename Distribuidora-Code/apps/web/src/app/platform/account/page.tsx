'use client';

import { useEffect, useState, FormEvent } from 'react';
import { api } from '@/lib/platform/api';

interface Admin {
  id: string;
  email: string;
  name: string | null;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function PlatformAccountPage() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  const [email, setEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailMsg, setEmailMsg] = useState('');
  const [emailError, setEmailError] = useState('');

  const [pwForm, setPwForm] = useState<PasswordForm>({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    api
      .get<Admin>('/auth/me')
      .then((data) => {
        setAdmin(data);
        setEmail(data.email);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSaveEmail(e: FormEvent) {
    e.preventDefault();
    setEmailError('');
    setEmailMsg('');
    setSavingEmail(true);
    try {
      const updated = await api.put<Admin>('/auth/profile', { email });
      setAdmin(updated);
      setEmail(updated.email);
      setEmailMsg('Email actualizado correctamente.');
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : 'Error al actualizar el email');
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwMsg('');

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Las contraseñas nuevas no coinciden');
      return;
    }

    setSavingPw(true);
    try {
      await api.put('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg('Contraseña actualizada correctamente.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error al cambiar la contraseña');
    } finally {
      setSavingPw(false);
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
    <div className="space-y-5 max-w-xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Mi cuenta</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Esta cuenta ve las mismas distribuidoras que cualquier otra cuenta de super admin — no es
          "tu" espacio separado, es solo tu acceso personal. Cambiá tu email y elegí tu propia
          contraseña acá.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Email</h3>
        {emailMsg && <div className="p-2 bg-green-50 text-green-700 text-sm rounded">{emailMsg}</div>}
        {emailError && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{emailError}</div>}
        <form onSubmit={handleSaveEmail} className="space-y-3">
          <div>
            <label className="label">Email de acceso</label>
            <input
              type="email"
              className="input"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <button type="submit" disabled={savingEmail} className="btn-primary text-sm">
            {savingEmail ? 'Guardando...' : 'Guardar email'}
          </button>
        </form>
      </div>

      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-gray-900">Cambiar contraseña</h3>
        {pwMsg && <div className="p-2 bg-green-50 text-green-700 text-sm rounded">{pwMsg}</div>}
        {pwError && <div className="p-2 bg-red-50 text-red-700 text-sm rounded">{pwError}</div>}
        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="label">Contraseña actual</label>
            <input
              type="password"
              className="input"
              required
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Contraseña nueva</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            />
          </div>
          <div>
            <label className="label">Repetir contraseña nueva</label>
            <input
              type="password"
              className="input"
              required
              minLength={8}
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
            />
          </div>
          <button type="submit" disabled={savingPw} className="btn-primary text-sm">
            {savingPw ? 'Guardando...' : 'Cambiar contraseña'}
          </button>
        </form>
      </div>
    </div>
  );
}
