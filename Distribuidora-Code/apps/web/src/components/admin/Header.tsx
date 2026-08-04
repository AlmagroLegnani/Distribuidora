'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/admin/api';
import { login as loginRequest, storeToken } from '@/lib/admin/auth';
import { useIdleTimer } from '@/lib/useIdleTimer';
import LockScreen from '@/components/LockScreen';

interface Distributor {
  name: string;
  email: string;
  slug: string;
}

export default function AdminHeader({ title }: { title?: string }) {
  const [distributor, setDistributor] = useState<Distributor | null>(null);
  const { locked, lock, unlock } = useIdleTimer();

  useEffect(() => {
    api
      .get<Distributor>('/auth/me')
      .then(setDistributor)
      .catch(() => null);
  }, []);

  async function handleUnlock(password: string): Promise<boolean> {
    if (!distributor) return false;
    try {
      const result = await loginRequest(distributor.email, password);
      storeToken(result.token);
      unlock();
      return true;
    } catch {
      return false;
    }
  }

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        {title && (
          <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
        )}
        <div className="ml-auto flex items-center gap-3">
          {distributor && (
            <>
              <button
                onClick={lock}
                title="Bloquear pantalla"
                className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 10-8 0v4h8z"
                  />
                </svg>
              </button>
              <div className="text-right">
                <div className="text-sm font-medium text-gray-900">{distributor.name}</div>
                <div className="text-xs text-gray-500">{distributor.email}</div>
              </div>
              <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm">
                {distributor.name.charAt(0).toUpperCase()}
              </div>
            </>
          )}
        </div>
      </header>

      <LockScreen
        visible={locked}
        title="Pantalla bloqueada"
        subtitle="Por seguridad, ingresá tu contraseña para continuar."
        label="Contraseña"
        onSubmit={handleUnlock}
      />
    </>
  );
}
