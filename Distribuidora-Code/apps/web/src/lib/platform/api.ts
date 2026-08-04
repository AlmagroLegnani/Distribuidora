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
  return localStorage.getItem('platform-auth-token');
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('platform-auth-token');
  document.cookie = 'platform-auth-token=; path=/; max-age=0; SameSite=Strict';
}

export async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/platform${endpoint}`, { ...options, headers });

  // Igual que en lib/admin/api.ts: un 401 sin token de por medio es una
  // respuesta normal a credenciales incorrectas (ej. /platform/auth/login),
  // no una sesión vencida — no hay que redirigir ni tapar el mensaje real.
  if (res.status === 401 && token) {
    clearAuth();
    // NOTA: a diferencia del original en apps/superadmin (que redirigía a
    // '/login'), acá redirige a '/platform-login' — en la app unificada
    // '/login' quedó reservado para el login del distribuidor.
    if (typeof window !== 'undefined') window.location.href = '/platform-login';
    throw new Error('Sesión expirada. Inicia sesión nuevamente.');
  }

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(endpoint: string) => apiRequest<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(endpoint: string, body: unknown) =>
    apiRequest<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(endpoint: string, body?: unknown) =>
    apiRequest<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
};
