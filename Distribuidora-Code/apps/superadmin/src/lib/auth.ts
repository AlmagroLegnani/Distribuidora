import { api } from './api';

export interface PlatformAdmin {
  id: string;
  email: string;
  name: string | null;
}

export async function login(email: string, password: string): Promise<{ token: string; admin: PlatformAdmin }> {
  return api.post<{ token: string; admin: PlatformAdmin }>('/auth/login', { email, password });
}

export function storeToken(token: string): void {
  localStorage.setItem('platform-auth-token', token);
  const maxAge = 7 * 24 * 60 * 60;
  document.cookie = `platform-auth-token=${token}; path=/; max-age=${maxAge}; SameSite=Strict`;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('platform-auth-token');
}

export function logout(): void {
  localStorage.removeItem('platform-auth-token');
  document.cookie = 'platform-auth-token=; path=/; max-age=0; SameSite=Strict';
  window.location.href = '/login';
}
