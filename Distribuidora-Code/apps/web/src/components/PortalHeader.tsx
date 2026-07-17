'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/cart';
import { loadAccess } from '@/lib/access';

interface Distributor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
}

export default function PortalHeader({
  distributor,
  slug,
}: {
  distributor: Distributor;
  slug: string;
}) {
  const { itemCount, total } = useCart();
  const [clientLabel, setClientLabel] = useState<string | null>(null);

  // El nombre del cliente se guardó localmente al verificar el código de
  // acceso (ver AccessGate) — lo leemos de ahí en vez de volver a pedirlo al
  // servidor, para no gastar cupo del rate-limiter en algo solo estético.
  useEffect(() => {
    const access = loadAccess(slug);
    setClientLabel(access?.clientName ?? null);
  }, [slug]);

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          {distributor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={distributor.logoUrl}
              alt={distributor.name}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {distributor.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-gray-900">{distributor.name}</span>
        </Link>

        <div className="flex items-center gap-2">
          {clientLabel && (
            <span className="text-xs text-gray-500 hidden md:block max-w-[160px] truncate">
              {clientLabel}
            </span>
          )}

          <Link
            href={`/${slug}/orders`}
            className="btn-secondary hidden sm:inline-flex"
          >
            Mis Pedidos
          </Link>

          <Link
            href={`/${slug}/cart`}
            className="flex items-center gap-2 btn-primary relative"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <span className="hidden sm:inline">Carrito</span>
            {itemCount > 0 && (
              <>
                <span className="bg-white text-blue-600 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
                <span className="hidden md:inline text-sm">{formatCurrency(total)}</span>
              </>
            )}
          </Link>

          <Link
            href="/distribuidoras"
            title="Ver otras distribuidoras (no cierra tu acceso acá)"
            className="btn-secondary hidden sm:inline-flex"
          >
            Cambiar de distribuidora
          </Link>
        </div>
      </div>

      {/* En mobile "Mis Pedidos" y "Cambiar de distribuidora" no entran en la
          fila de arriba — van en una barra fija abajo de la pantalla, que
          queda siempre visible aunque se scrollee (como en las apps). */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200 shadow-[0_-1px_4px_rgba(0,0,0,0.05)] flex items-stretch">
        <Link
          href={`/${slug}/orders`}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-600 active:bg-gray-50"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 17v-2a4 4 0 014-4h4m0 0l-3-3m3 3l-3 3M5 7h14M5 12h4m-4 5h4"
            />
          </svg>
          <span className="text-[11px] font-medium">Mis Pedidos</span>
        </Link>
        <Link
          href="/distribuidoras"
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-gray-600 active:bg-gray-50 border-l border-gray-100"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7h12m0 0l-4-4m4 4l-4 4M16 17H4m0 0l4 4m-4-4l4-4"
            />
          </svg>
          <span className="text-[11px] font-medium">Cambiar distribuidora</span>
        </Link>
      </nav>
    </header>
  );
}
