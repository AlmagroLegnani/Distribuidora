'use client';

import { useSearchParams } from 'next/navigation';

export default function SignupSuccessPage() {
  const searchParams = useSearchParams();
  const slug = searchParams.get('slug');
  const pending = searchParams.get('pending');
  const failed = searchParams.get('failed');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="card max-w-md w-full p-8 text-center space-y-4">
        {failed ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">El pago no se pudo procesar</h1>
            <p className="text-gray-500 text-sm">
              Tu cuenta ya está creada y tu prueba gratuita sigue activa. Puedes intentar pagar de nuevo
              más tarde desde Configuración en tu backoffice.
            </p>
          </>
        ) : pending ? (
          <>
            <h1 className="text-xl font-bold text-gray-900">Pago en revisión</h1>
            <p className="text-gray-500 text-sm">
              Estamos confirmando tu pago con MercadoPago. Tu cuenta ya está activa mientras tanto.
            </p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-gray-900">¡Cuenta creada!</h1>
            <p className="text-gray-500 text-sm">Tu distribuidora ya está lista para usarse.</p>
          </>
        )}

        <a href="http://localhost:3002/login" className="btn-primary w-full justify-center">
          Ir a mi backoffice
        </a>
        {slug && (
          <a href={`/${slug}`} className="block text-sm text-blue-600 hover:text-blue-700">
            Ver mi catálogo público →
          </a>
        )}
      </div>
    </div>
  );
}
