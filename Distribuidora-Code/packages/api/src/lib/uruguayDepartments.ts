// Los 19 departamentos de Uruguay — lista fija para que el campo "ciudad" de
// una distribuidora (Distributor.city) sea siempre uno de estos valores, así
// el filtro por zona en /distribuidoras funciona sin depender de cómo cada
// operador tipeó el nombre (ej. "San Jose" vs "San José" vs "san jose de mayo").
export const URUGUAY_DEPARTMENTS = [
  'Artigas',
  'Canelones',
  'Cerro Largo',
  'Colonia',
  'Durazno',
  'Flores',
  'Florida',
  'Lavalleja',
  'Maldonado',
  'Montevideo',
  'Paysandú',
  'Río Negro',
  'Rivera',
  'Rocha',
  'Salto',
  'San José',
  'Soriano',
  'Tacuarembó',
  'Treinta y Tres',
] as const;

export type UruguayDepartment = (typeof URUGUAY_DEPARTMENTS)[number];
