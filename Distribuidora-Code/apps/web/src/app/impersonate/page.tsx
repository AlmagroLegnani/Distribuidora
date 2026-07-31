'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { storeToken } from '@/lib/admin/auth';

// Landing intermedia para "Entrar como esta distribuidora": recibe el token
// de soporte generado por el super admin, lo guarda igual que un login normal
// (localStorage + cookie) y redirige al panel del distribuidor.
// Vive fuera de /admin a propósito: el middleware exige la cookie antes de
// dejar pasar a /admin/*, así que necesitamos esta ruta "de paso" para poder
// guardarla primero.
function ImpersonateInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    storeToken(token);
    router.replace('/admin');
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-gray-500">Entrando al panel...</p>
    </div>
  );
}

export default function ImpersonatePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <p className="text-sm text-gray-500">Entrando al panel...</p>
        </div>
      }
    >
      <ImpersonateInner />
    </Suspense>
  );
}
