import { api } from './api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
}

export async function login(email: string, password: string): Promise<{ token: string; distributor: AuthUser }> {
  return api.post<{ token: string; distributor: AuthUser }>('/auth/login', { email, password });
}

export function storeToken(token: string): void {
  localStorage.setItem('auth-token', token);
  // Also set a cookie so Next.js middleware can read it
  const maxAge = 7 * 24 * 60 * 60; // 7 days
  document.cookie = `auth-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
}

export function logout(): void {
  localStorage.removeItem('auth-token');
  document.cookie = 'auth-token=; path=/; max-age=0; SameSite=Strict';
  window.location.href = '/login';
}

export function isAuthenticated(): boolean {
  return !!getToken();
}
