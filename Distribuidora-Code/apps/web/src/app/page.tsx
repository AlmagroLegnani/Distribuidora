import Link from 'next/link';

const ADMIN_LOGIN_URL =
  process.env.NEXT_PUBLIC_ADMIN_URL || 'http://localhost:3002';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-xl w-full">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">StockApp</h1>
          <p className="text-gray-500 mt-2">¿Cómo querés ingresar?</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {/* Soy cliente */}
          <Link
            href="/distribuidoras"
            className="card p-8 flex flex-col items-center text-center gap-3 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Soy cliente</div>
              <p className="text-sm text-gray-500 mt-1">
                Quiero ver el catálogo y stock de mi distribuidora
              </p>
            </div>
          </Link>

          {/* Soy distribuidora */}
          <a
            href={`${ADMIN_LOGIN_URL}/login`}
            className="card p-8 flex flex-col items-center text-center gap-3 hover:shadow-md hover:border-blue-200 transition-all"
          >
            <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H2m5 0h5m0 0V13a1 1 0 011-1h0a1 1 0 011 1v8m-3 0h3"
                />
              </svg>
            </div>
            <div>
              <div className="font-semibold text-gray-900">Soy distribuidora</div>
              <p className="text-sm text-gray-500 mt-1">
                Quiero ingresar a mi backoffice para gestionar pedidos y stock
              </p>
            </div>
          </a>
        </div>

        <p className="text-center text-sm text-gray-500 mt-8">
          ¿Todavía no te dimos de alta? Escribinos y te registramos como distribuidora: vas a
          recibir por email un código de acceso único para ingresar a tu backoffice.
        </p>
      </div>
    </div>
  );
}
