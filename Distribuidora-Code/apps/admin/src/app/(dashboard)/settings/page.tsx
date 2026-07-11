'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Settings {
  notificationEmail: string | null;
  whatsappNumber: string | null;
  sendClientEmail: boolean;
  sendWhatsapp: boolean;
}

interface Subscription {
  status: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  plan: { name: string; price: number; currency: string };
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  TRIALING: 'En período de prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago vencido — regulariza pronto',
  SUSPENDED: 'Suspendida por falta de pago',
  CANCELLED: 'Cancelada',
};

interface SettingsForm {
  notificationEmail: string;
  whatsappNumber: string;
  sendClientEmail: boolean;
  sendWhatsapp: boolean;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SettingsForm>({
    notificationEmail: '',
    whatsappNumber: '',
    sendClientEmail: true,
    sendWhatsapp: false,
  });
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState('');

  const [pwForm, setPwForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');

  useEffect(() => {
    api
      .get<{ settings: Settings | null; subscription: Subscription | null }>('/auth/me')
      .then((data) => {
        if (data.settings) {
          setSettings({
            notificationEmail: data.settings.notificationEmail || '',
            whatsappNumber: data.settings.whatsappNumber || '',
            sendClientEmail: data.settings.sendClientEmail,
            sendWhatsapp: data.settings.sendWhatsapp,
          });
        }
        setSubscription(data.subscription);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handlePayNow() {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      const { checkoutUrl } = await api.post<{ checkoutUrl: string }>('/auth/billing/checkout', {});
      window.location.href = checkoutUrl;
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'No se pudo generar el link de pago');
    } finally {
      setCheckoutLoading(false);
    }
  }

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMsg('');
    try {
      await api.put('/auth/settings', {
        notificationEmail: settings.notificationEmail || null,
        whatsappNumber: settings.whatsappNumber || null,
        sendClientEmail: settings.sendClientEmail,
        sendWhatsapp: settings.sendWhatsapp,
      });
      setSettingsMsg('Configuración guardada.');
    } catch (err) {
      setSettingsMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingSettings(false);
    }
  }

  async function changePassword() {
    setPwError('');
    setPwMsg('');
    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Las contraseñas no coinciden');
      return;
    }
    if (pwForm.newPassword.length < 8) {
      setPwError('La nueva contraseña debe tener al menos 8 caracteres');
      return;
    }
    setSavingPw(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwMsg('Contraseña actualizada correctamente.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
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
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900">Configuración</h2>

      {/* Subscription */}
      {subscription && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Mi Suscripción</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Plan</div>
              <div className="font-medium text-gray-900">
                {subscription.plan.name} —{' '}
                {new Intl.NumberFormat('es-CL', {
                  style: 'currency',
                  currency: subscription.plan.currency,
                  minimumFractionDigits: 0,
                }).format(subscription.plan.price)}
                /mes
              </div>
            </div>
            <div>
              <div className="text-gray-500">Estado</div>
              <div className="font-medium text-gray-900">
                {STATUS_LABELS[subscription.status] || subscription.status}
              </div>
            </div>
            <div>
              <div className="text-gray-500">
                {subscription.status === 'TRIALING' ? 'Prueba termina' : 'Próximo cobro / vencimiento'}
              </div>
              <div className="font-medium text-gray-900">
                {subscription.currentPeriodEnd || subscription.trialEndsAt
                  ? new Intl.DateTimeFormat('es-CL', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
                      new Date(subscription.currentPeriodEnd ?? subscription.trialEndsAt!)
                    )
                  : '—'}
              </div>
            </div>
          </div>

          {checkoutError && (
            <div className="text-sm p-2 rounded bg-red-50 text-red-700">{checkoutError}</div>
          )}

          <button onClick={handlePayNow} disabled={checkoutLoading} className="btn-primary">
            {checkoutLoading ? 'Generando link...' : 'Pagar / renovar con MercadoPago'}
          </button>
        </div>
      )}

      {/* Notifications */}
      <div className="card p-6 space-y-5">
        <h3 className="font-semibold text-gray-900 text-lg">Notificaciones</h3>

        <div>
          <label className="label">Email de notificaciones del distribuidor</label>
          <input
            type="email"
            value={settings.notificationEmail}
            onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
            placeholder="pedidos@tuemail.com"
            className="input"
          />
          <p className="text-xs text-gray-400 mt-1">
            Recibirás un email aquí cada vez que llegue un nuevo pedido.
          </p>
        </div>

        <div>
          <label className="label">Número de WhatsApp (con código de país)</label>
          <input
            type="tel"
            value={settings.whatsappNumber}
            onChange={(e) => setSettings({ ...settings, whatsappNumber: e.target.value })}
            placeholder="+56912345678"
            className="input"
          />
        </div>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sendClientEmail}
              onChange={(e) => setSettings({ ...settings, sendClientEmail: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Enviar email de confirmación al cliente
              </div>
              <div className="text-xs text-gray-500">
                Se enviará al email del cliente si está registrado
              </div>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.sendWhatsapp}
              onChange={(e) => setSettings({ ...settings, sendWhatsapp: e.target.checked })}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <div>
              <div className="text-sm font-medium text-gray-900">
                Enviar notificación por WhatsApp
              </div>
              <div className="text-xs text-gray-500">
                Requiere configuración de Twilio en el servidor
              </div>
            </div>
          </label>
        </div>

        {settingsMsg && (
          <div className={`text-sm p-2 rounded ${
            settingsMsg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {settingsMsg}
          </div>
        )}

        <button onClick={saveSettings} disabled={savingSettings} className="btn-primary">
          {savingSettings ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </div>

      {/* Change Password */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg">Cambiar Contraseña</h3>

        {pwError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {pwError}
          </div>
        )}
        {pwMsg && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
            {pwMsg}
          </div>
        )}

        <div>
          <label className="label">Contraseña actual</label>
          <input
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Nueva contraseña</label>
          <input
            type="password"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">Confirmar nueva contraseña</label>
          <input
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
            className="input"
          />
        </div>

        <button onClick={changePassword} disabled={savingPw} className="btn-primary">
          {savingPw ? 'Actualizando...' : 'Cambiar contraseña'}
        </button>
      </div>
    </div>
  );
}
