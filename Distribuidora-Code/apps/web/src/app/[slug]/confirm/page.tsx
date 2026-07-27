'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useParams } from 'next/navigation';
import Link from 'next/link';
import { formatCurrency } from '@/lib/cart';
import { IVA_LABELS, ivaAmountFromFinalPrice } from '@/lib/iva';
import type { IvaType, OrderResult } from '@/lib/api';

export default function ConfirmPage() {
  const params = useParams();
  const slug = params.slug as string;
  const searchParams = useSearchParams();

  const orderId = searchParams.get('orderId') || '';
  const totalFromUrl = parseFloat(searchParams.get('total') || '0');
  const shortId = orderId.slice(-8).toUpperCase();

  const [order, setOrder] = useState<OrderResult | null>(null);

  useEffect(() => {
    if (!orderId) return;
    try {
      const raw = sessionStorage.getItem(`order_${orderId}`);
      if (raw) setOrder(JSON.parse(raw));
    } catch {
      // Sin detalle disponible: se muestra el resumen mínimo (total).
    }
  }, [orderId]);

  // Desglose de IVA por tasa, solo con las tasas que realmente aparecen
  // en el pedido (misma lógica que el comprobante PDF).
  const subtotalByIva: Record<IvaType, number> = { BASICA: 0, MINIMA: 0 };
  if (order) {
    for (const item of order.items) {
      subtotalByIva[item.ivaType] += item.subtotal;
    }
  }
  const ivaTypesUsed = (Object.keys(subtotalByIva) as IvaType[]).filter(
    (t) => subtotalByIva[t] > 0
  );

  return (
    <div className="max-w-2xl mx-auto py-10 print:py-0">
      <div className="card p-8 space-y-6 print:shadow-none print:border-none">
        <div className="text-center space-y-3">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto print:hidden">
            <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            <p className="text-gray-500 mt-2 print:hidden">
              Tu pedido ha sido recibido y será procesado a la brevedad.
            </p>
          </div>
          <p className="text-sm text-gray-500">
            Pedido <span className="font-mono font-bold text-gray-900">#{shortId}</span>
          </p>
        </div>

        {order ? (
          <>
            <div className="border border-gray-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Producto</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">Cant.</th>
                    <th className="text-center px-3 py-2 font-medium text-gray-600">IVA</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Precio</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {order.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.product.name}</div>
                        {item.product.code && (
                          <div className="text-xs text-gray-400 font-mono">{item.product.code}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-center">{item.quantity}</td>
                      <td className="px-3 py-2 text-center text-xs text-gray-500">
                        {IVA_LABELS[item.ivaType]}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200">
                  <tr>
                    <td colSpan={4} className="px-3 py-3 text-right font-bold text-gray-900">
                      TOTAL
                    </td>
                    <td className="px-3 py-3 text-right font-bold text-blue-700">
                      {formatCurrency(order.total)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {ivaTypesUsed.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                <p className="text-xs font-semibold text-gray-500">
                  Discriminación de IVA (incluido en el precio)
                </p>
                {ivaTypesUsed.map((ivaType) => {
                  const subtotal = subtotalByIva[ivaType];
                  const ivaAmount = ivaAmountFromFinalPrice(subtotal, ivaType);
                  return (
                    <div key={ivaType} className="flex justify-between text-xs text-gray-500">
                      <span>{IVA_LABELS[ivaType]} — gravado: {formatCurrency(subtotal)}</span>
                      <span>IVA contenido: {formatCurrency(ivaAmount)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total:</span>
              <span className="font-bold text-blue-700 text-base">{formatCurrency(totalFromUrl)}</span>
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center print:hidden">
          Recibirás una confirmación por email si proporcionaste tu correo electrónico.
        </p>

        <div className="flex flex-col gap-2 pt-2 print:hidden">
          <Link href={`/${slug}`} className="btn-primary w-full">
            Hacer otro pedido
          </Link>
          <button onClick={() => window.print()} className="btn-secondary w-full">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Imprimir comprobante
          </button>
        </div>
      </div>
    </div>
  );
}
