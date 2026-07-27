import type { IvaType } from './api';

/**
 * Tasas de IVA de Uruguay soportadas por StockApp. Los precios que carga
 * la distribuidora ya son precios finales (IVA incluido) — esto solo se
 * usa para mostrar la etiqueta y calcular el IVA "contenido" en el precio,
 * nunca para recalcular el precio en sí. Debe coincidir con
 * packages/api/src/lib/iva.ts.
 */
export const IVA_RATES: Record<IvaType, number> = {
  BASICA: 0.22,
  MINIMA: 0.1,
};

export const IVA_LABELS: Record<IvaType, string> = {
  BASICA: 'IVA 22%',
  MINIMA: 'IVA 10%',
};

/** Monto de IVA contenido en un precio final (IVA incluido). */
export function ivaAmountFromFinalPrice(finalPrice: number, ivaType: IvaType): number {
  const rate = IVA_RATES[ivaType];
  return finalPrice - finalPrice / (1 + rate);
}
