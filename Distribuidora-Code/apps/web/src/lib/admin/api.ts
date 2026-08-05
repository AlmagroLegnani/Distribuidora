// En el navegador usamos ruta relativa (Next.js la reenvía al backend interno
// vía rewrites, ver next.config.js). Si en algún momento este módulo se
// llegara a usar desde un Server Component, una URL relativa no se puede
// resolver en el servidor — por eso el fallback a la API interna directa.
const API_URL =
  typeof window === 'undefined'
    ? `${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api`
    : '/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('auth-token');
  document.cookie = 'auth-token=; path=/; max-age=0; SameSite=Strict';
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  // Un 401 solo significa "se venció la sesión" si veníamos usando un token
  // (request autenticado). Si no había token —como al intentar iniciar
  // sesión con datos incorrectos— el 401 es la respuesta normal del backend
  // a credenciales inválidas, y no hay que redirigir ni tapar el mensaje de
  // error real: dejamos que caiga al manejo genérico de abajo.
  if (res.status === 401 && token) {
    clearAuth();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  // Handle 204 No Content
  if (res.status === 204) return undefined as T;

  return res.json();
}

/**
 * Requests the printable PDF receipt for an order. Unlike `apiRequest`, this
 * expects a binary (application/pdf) response instead of JSON, and reads the
 * `X-Client-Email` response header the API sets when it also emailed the
 * receipt to the client, so the caller can surface that to the user.
 */
export async function fetchOrderReceipt(orderId: string): Promise<{ blob: Blob; emailedTo: string | null }> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/orders/${orderId}/receipt`, { method: 'POST', headers });

  if (res.status === 401) {
    clearAuth();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore json parse errors
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  return { blob, emailedTo: res.headers.get('X-Client-Email') };
}

/**
 * Sube una foto de producto a Cloudinary (vía el backend) y devuelve su URL
 * pública. No usa `apiRequest` porque el body es `FormData` (multipart), no
 * JSON — hay que dejar que el navegador ponga su propio `Content-Type` con
 * el boundary, nunca fijarlo a mano.
 */
export async function uploadProductImage(file: File): Promise<{ url: string }> {
  const token = getToken();
  const body = new FormData();
  body.append('image', file);

  const res = await fetch(`${API_URL}/products/upload-image`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });

  if (!res.ok) {
    let message = 'Error al subir la imagen';
    try {
      const data = await res.json();
      message = data.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

export interface StockAlert {
  id: string;
  type: 'LOW_STOCK' | 'PAYMENT_DUE' | 'REORDER_SUGGESTION';
  message: string | null;
  productId: string | null;
  productName: string | null;
  stockAtAlert: number | null;
  threshold: number | null;
  clientId: string | null;
  clientName: string | null;
  reminderSentAt: string | null;
  read: boolean;
  emailSentAt: string | null;
  createdAt: string;
}

/** Alertas de stock bajo aún no vistas — usadas por el modal al ingresar al panel. */
export async function getUnreadNotifications(): Promise<StockAlert[]> {
  return apiRequest<StockAlert[]>('/notifications/unread', { method: 'GET' });
}

/** Historial completo de alertas de stock bajo, para la sección de Notificaciones. */
export async function getNotifications(): Promise<StockAlert[]> {
  return apiRequest<StockAlert[]>('/notifications', { method: 'GET' });
}

/** Marca notificaciones como leídas. Sin `ids`, marca todas las pendientes. */
export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await apiRequest('/notifications/read', {
    method: 'PATCH',
    body: JSON.stringify({ ids }),
  });
}

/** Elimina una notificación puntual (ya resuelta, ej. se repuso el stock). */
export async function deleteNotification(id: string): Promise<void> {
  await apiRequest(`/notifications/${id}`, { method: 'DELETE' });
}

/** Botón "Enviar recordatorio" de una sugerencia de recompra: manda un push al cliente. */
export async function sendReminder(id: string): Promise<{ sent: boolean; reason?: string }> {
  return apiRequest(`/notifications/${id}/send-reminder`, { method: 'POST' });
}

export interface PeriodStats {
  orders: number;
  revenue: number;
  clientsWithOrders: number;
  totalActiveClients: number;
  pctClientsWithOrders: number;
}

export interface OrderBalance {
  totalActiveClients: number;
  allTime: { orders: number; revenue: number };
  day: PeriodStats;
  week: PeriodStats;
  month: PeriodStats;
}

export interface ClientOrderBalance {
  clientId: string;
  name: string;
  ordersToday: number;
  ordersThisWeek: number;
  ordersThisMonth: number;
  ordersTotal: number;
  lastOrderAt: string | null;
}

/** Balance estadístico: pedidos y % de clientes activos que pidieron hoy/semana/mes. */
export async function getOrderBalance(): Promise<OrderBalance> {
  return apiRequest<OrderBalance>('/stats/balance', { method: 'GET' });
}

/** Desglose de pedidos por cliente (hoy/semana/mes/histórico), para la vista "Por cliente". */
export async function getClientOrderBalance(): Promise<ClientOrderBalance[]> {
  return apiRequest<ClientOrderBalance[]>('/stats/balance/clientes', { method: 'GET' });
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'DELETE' }),
};
