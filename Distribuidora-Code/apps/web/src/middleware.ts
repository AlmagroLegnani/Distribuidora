import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Consolida los dos middlewares que antes vivían separados en apps/admin
// (cookie `auth-token`) y apps/superadmin (cookie `platform-auth-token`).
// Esto es solo protección de NAVEGACIÓN (evita que alguien sin sesión vea
// una pantalla del panel, o que un logueado vea el login de nuevo) — el
// backend (Express) sigue validando el JWT y el rol en cada request, que es
// donde realmente se aplica la seguridad.

const ADMIN_PREFIX = '/admin';
const PLATFORM_PREFIX = '/platform';
const PLATFORM_LOGIN_PATH = '/platform-login';
const ADMIN_LOGIN_PATH = '/login';
// Rutas del flujo de auth del distribuidor que deben quedar accesibles sin
// sesión (igual que en el middleware original de apps/admin).
const ADMIN_AUTH_PATHS = [ADMIN_LOGIN_PATH, '/forgot-password', '/reset-password'];

function isAdminArea(pathname: string): boolean {
  return pathname === ADMIN_PREFIX || pathname.startsWith(`${ADMIN_PREFIX}/`);
}

function isPlatformArea(pathname: string): boolean {
  return pathname === PLATFORM_PREFIX || pathname.startsWith(`${PLATFORM_PREFIX}/`);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const adminToken = request.cookies.get('auth-token')?.value;
  const platformToken = request.cookies.get('platform-auth-token')?.value;

  // Home pública: si ya hay una sesión activa, mandamos directo al panel
  // correspondiente en vez de mostrar la landing de nuevo.
  if (pathname === '/') {
    if (adminToken) return NextResponse.redirect(new URL(ADMIN_PREFIX, request.url));
    if (platformToken) return NextResponse.redirect(new URL(PLATFORM_PREFIX, request.url));
    return NextResponse.next();
  }

  // Panel del distribuidor
  if (isAdminArea(pathname)) {
    if (!adminToken) return NextResponse.redirect(new URL(ADMIN_LOGIN_PATH, request.url));
    return NextResponse.next();
  }

  // Panel de plataforma
  if (isPlatformArea(pathname)) {
    if (!platformToken) return NextResponse.redirect(new URL(PLATFORM_LOGIN_PATH, request.url));
    return NextResponse.next();
  }

  // Login / recuperación de contraseña del distribuidor: si ya está
  // autenticado, no tiene sentido mostrarle el login de nuevo (solo aplica
  // a /login, igual que en el middleware original — forgot/reset quedan
  // siempre accesibles).
  if (ADMIN_AUTH_PATHS.includes(pathname)) {
    if (adminToken && pathname === ADMIN_LOGIN_PATH) {
      return NextResponse.redirect(new URL(ADMIN_PREFIX, request.url));
    }
    return NextResponse.next();
  }

  // Login de plataforma
  if (pathname === PLATFORM_LOGIN_PATH) {
    if (platformToken) return NextResponse.redirect(new URL(PLATFORM_PREFIX, request.url));
    return NextResponse.next();
  }

  // Resto de rutas: públicas (catálogo por /[slug], /distribuidoras, /contacto, etc.)
  // — el acceso del cliente no usa JWT/cookies, se valida por RUT/Cédula +
  // código contra el backend y se persiste en localStorage, así que no hay
  // nada que este middleware deba controlar acá.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
