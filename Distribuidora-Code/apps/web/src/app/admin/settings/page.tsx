'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/admin/api';
import { URUGUAY_DEPARTMENTS } from '@/lib/uruguayDepartments';

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

interface ProfileForm {
  rut: string;
  cedula: string;
  address: string;
  city: string;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const paymentResult = searchParams.get('payment'); // success | pending | failed, seteado al volver de MercadoPago

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

  const [profile, setProfile] = useState<ProfileForm>({ rut: '', cedula: '', address: '', city: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  const [passwordChanged, setPasswordChanged] = useState(false);

  useEffect(() => {
    api
      .get<{
        settings: Settings | null;
        subscription: Subscription | null;
        rut: string | null;
        cedula: string | null;
        address: string | null;
        city: string | null;
        passwordChanged: boolean;
      }>('/auth/me')
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
        setProfile({
          rut: data.rut || '',
          cedula: data.cedula || '',
          address: data.address || '',
          city: data.city || '',
        });
        setPasswordChanged(data.passwordChanged);
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

  async function saveProfile() {
    setSavingProfile(true);
    setProfileMsg('');
    try {
      await api.put('/auth/profile', {
        rut: profile.rut || null,
        cedula: profile.cedula || null,
        address: profile.address || null,
        city: profile.city || null,
      });
      setProfileMsg('Datos guardados.');
    } catch (err) {
      setProfileMsg(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSavingProfile(false);
    }
  }

  async function changePassword() {
    setPwError('');
    setPwMsg('');
    if (passwordChanged && !pwForm.currentPassword) {
      setPwError('Ingresá tu contraseña actual');
      return;
    }
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
        ...(passwordChanged ? { currentPassword: pwForm.currentPassword } : {}),
        newPassword: pwForm.newPassword,
      });
      setPwMsg(passwordChanged ? 'Contraseña actualizada correctamente.' : '¡Contraseña creada! Ya podés usarla para entrar.');
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordChanged(true);
    } catch (err) {
      setPwError(err instanceof Error ? err.message : 'Error al cambiar contraseña');
    } finally {
      setSavingPw(false);
    }
  }

  function daysUntil(dateStr: string | null): number | null {
    if (!dateStr) return null;
    const diffMs = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  const trialDaysLeft =
    subscription?.status === 'TRIALING' ? daysUntil(subscription.trialEndsAt) : null;
  const showTrialWarning = trialDaysLeft !== null && trialDaysLeft <= 5;
  const showPastDueWarning = subscription?.status === 'PAST_DUE';

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

      {paymentResult === 'success' && (
        <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
          ¡Pago recibido! Puede tardar unos segundos en reflejarse acá abajo.
        </div>
      )}
      {paymentResult === 'pending' && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          Tu pago está en revisión por MercadoPago. Te avisamos cuando se confirme.
        </div>
      )}
      {paymentResult === 'failed' && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          El pago no se pudo procesar. Podés intentar de nuevo con el botón de abajo.
        </div>
      )}

      {showTrialWarning && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          {trialDaysLeft! > 0 ? (
            <>
              Tu prueba gratuita termina en <strong>{trialDaysLeft} día{trialDaysLeft === 1 ? '' : 's'}</strong>.
              Contactanos para coordinar el pago mensual según lo acordado y no perder el acceso a tu catálogo.
            </>
          ) : (
            <>
              Tu prueba gratuita ya terminó. Contactanos a la brevedad para coordinar el pago mensual y
              evitar que se suspenda el acceso a tu catálogo.
            </>
          )}
        </div>
      )}

      {showPastDueWarning && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          Tu pago está vencido. Tenés unos días de gracia antes de que se suspenda el acceso a tu catálogo —
          contactanos o regularizalo para seguir usando la app sin interrupciones.
        </div>
      )}

      {/* Subscription */}
      {subscription && (
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold text-gray-900 text-lg">Mi Suscripción</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-500">Plan</div>
              <div className="font-medium text-gray-900">
                {subscription.plan.name} —{' '}
                {new Intl.NumberFormat('es-UY', {
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
                  ? new Intl.DateTimeFormat('es-UY', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(
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
          <p className="text-xs text-gray-400">
            También podés coordinar el pago directamente con nosotros según lo acordado en tu contrato.
          </p>
        </div>
      )}

      {/* Datos de la empresa */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg">Datos de tu empresa</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">RUT</label>
            <input
              value={profile.rut}
              onChange={(e) => setProfile({ ...profile, rut: e.target.value })}
              placeholder="21-123456-0019"
              className="input"
            />
          </div>
          <div>
            <label className="label">Cédula</label>
            <input
              value={profile.cedula}
              onChange={(e) => setProfile({ ...profile, cedula: e.target.value })}
              placeholder="1.234.567-8"
              className="input"
            />
          </div>
          <div className="col-span-2">
            <label className="label">Dirección</label>
            <input
              value={profile.address}
              onChange={(e) => setProfile({ ...profile, address: e.target.value })}
              placeholder="Ej: Av. 18 de Julio 1234"
              className="input"
            />
          </div>
          <div>
            <label className="label">Ciudad / Departamento</label>
            <select
              value={profile.city}
              onChange={(e) => setProfile({ ...profile, city: e.target.value })}
              className="input"
            >
              <option value="">Sin especificar</option>
              {URUGUAY_DEPARTMENTS.map((dep) => (
                <option key={dep} value={dep}>
                  {dep}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Cargá RUT o Cédula, lo que tenga tu negocio. La ciudad es la que el cliente va a poder usar
          para filtrarte en "Elegí tu distribuidora".
        </p>

        {profileMsg && (
          <div
            className={`text-sm p-2 rounded ${
              profileMsg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
            }`}
          >
            {profileMsg}
          </div>
        )}

        <button onClick={saveProfile} disabled={savingProfile} className="btn-primary">
          {savingProfile ? 'Guardando...' : 'Guardar datos'}
        </button>
      </div>

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

      {/* Password: la primera vez es "creá tu contraseña" (todavía está usando
          el código de acceso que le mandamos por email), después pasa a ser
          el formulario normal de "cambiar contraseña" pidiendo la actual. */}
      <div className="card p-6 space-y-4">
        <h3 className="font-semibold text-gray-900 text-lg">
          {passwordChanged ? 'Cambiar Contraseña' : 'Creá tu contraseña'}
        </h3>
        {!passwordChanged && (
          <p className="text-sm text-gray-500 -mt-2">
            Todavía estás usando el código de acceso que te llegó por email para entrar. Elegí acá
            una contraseña propia para usar de ahora en más.
          </p>
        )}

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

        {passwordChanged && (
          <div>
            <label className="label">Contraseña actual</label>
            <input
              type="password"
              value={pwForm.currentPassword}
              onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
              className="input"
            />
          </div>
        )}
        <div>
          <label className="label">{passwordChanged ? 'Nueva contraseña' : 'Contraseña'}</label>
          <input
            type="password"
            value={pwForm.newPassword}
            onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
            className="input"
          />
        </div>
        <div>
          <label className="label">{passwordChanged ? 'Confirmar nueva contraseña' : 'Confirmar contraseña'}</label>
          <input
            type="password"
            value={pwForm.confirmPassword}
            onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
            className="input"
          />
        </div>

        <button onClick={changePassword} disabled={savingPw} className="btn-primary">
          {savingPw ? 'Guardando...' : passwordChanged ? 'Cambiar contraseña' : 'Crear contraseña'}
        </button>
      </div>
    </div>
  );
}
