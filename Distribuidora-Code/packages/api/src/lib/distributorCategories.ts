// Rubros de distribuidoras mayoristas, basado en los rubros más comunes del
// mercado uruguayo. Una distribuidora puede pertenecer a más de un rubro.
export const DISTRIBUTOR_CATEGORIES = [
  'Alimentos No Perecederos', // enlatados, fideos, harina, arroz, azúcar, etc.
  'Lácteos y Fríos',
  'Bebidas',
  'Panadería y Pastelería',
  'Limpieza e Higiene',
  'Papelería y Oficina',
  'Electrónica y Tecnología',
  'Textil e Indumentaria',
  'Farmacia y Perfumería',
  'Ferretería y Bazar',
  'Otro',
] as const;

export type DistributorCategory = (typeof DISTRIBUTOR_CATEGORIES)[number];
