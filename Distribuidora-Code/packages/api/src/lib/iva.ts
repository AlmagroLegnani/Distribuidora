import { IvaType } from '@prisma/client';

/**
 * Tasas de IVA vigentes en Uruguay relevantes para el catálogo de un
 * distribuidor (Básica y Mínima — no se contempla la tasa 0%/exenta hoy).
 * Los precios cargados por la distribuidora ya son precios finales (con IVA
 * incluido); estos porcentajes solo se usan para mostrar la tasa y, en el
 * comprobante, calcular cuánto de ese precio final corresponde a IVA.
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
