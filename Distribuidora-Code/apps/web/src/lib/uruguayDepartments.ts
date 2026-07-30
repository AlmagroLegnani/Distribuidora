// Los 19 departamentos de Uruguay — misma lista que
// packages/api/src/lib/uruguayDepartments.ts, usada acá para el desplegable
// de "Ciudad" (alta de distribuidora, Configuración, filtro de /distribuidoras).
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
