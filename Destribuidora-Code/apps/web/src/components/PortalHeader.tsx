'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/cart';

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
      </div>
    </header>
  );
}
