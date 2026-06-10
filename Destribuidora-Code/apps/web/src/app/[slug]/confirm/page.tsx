'use client';

import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/cart';

export default function ConfirmPage() {
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || '';
  const total = parseFloat(searchParams.get('total') || '0');
  const shortId = orderId.slice(-8).toUpperCase();

  return (
    <div className="max-w-md mx-auto py-10">
      <div className="card p-8 text-center space-y-5">
        {/* Success icon */}
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
          <svg
            className="w-10 h-10 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900">¡Pedido Confirmado!</h2>
          <p className="text-gray-500 mt-2">
            Tu pedido ha sido recibido y será procesado a la brevedad.
          </p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Número de pedido:</span>
            <span className="font-mono font-bold text-gray-900">#{shortId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Total:</span>
            <span className="font-bold text-blue-700 text-base">{formatCurrency(total)}</span>
          </div>
        </div>

        <p className="text-xs text-gray-400">
          Recibirás una confirmación por email si proporcionaste tu correo electrónico.
        </p>

        <div className="flex flex-col gap-2 pt-2">
          <Link href={`/${slug}`} className="btn-primary w-full">
            Hacer otro pedido
          </Link>
          <button
            onClick={() => window.print()}
            className="btn-secondary w-full"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Imprimir comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
