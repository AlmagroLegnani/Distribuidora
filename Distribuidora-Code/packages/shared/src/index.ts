// Shared TypeScript types used across API and frontend apps

export type OrderStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'CANCELLED';

export interface DistributorPublic {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
}

export interface ProductPublic {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export interface ClientPublic {
  id: string;
  rut: string | null;
  cedula: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  documento: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  items: OrderItemInput[];
  notes?: string;
}

export interface OrderItemDetail {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  product: {
    name: string;
    code: string | null;
  };
}

export interface OrderDetail {
  id: string;
  total: number;
  status: OrderStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  client: ClientPublic;
  items: OrderItemDetail[];
}

export interface OrderSummary {
  id: string;
  total: number;
  status: OrderStatus;
  createdAt: string;
  client: {
    rut: string | null;
    cedula: string | null;
    name: string | null;
  };
}

export interface DashboardStats {
  totalOrdersToday: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  recentOrders: OrderSummary[];
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Identity document validation (Uruguay) ────────────────────────────────
// A client can be identified by RUT (DGI, businesses) or Cédula de Identidad
// (DNIC, people/small almacenes without a RUT) — see each distributor's
// client list, where at least one of the two is required.

/** RUT: 12 digits — 2 (DGI office, 01-21) + 6 (company) + 2 ("00") + 1 + check digit. */
export function validateRUT(input: string): boolean {
  const clean = (input || '').replace(/\D/g, '');
  if (clean.length !== 11 && clean.length !== 12) return false;

  const digit = (i: number) => parseInt(clean[i - 1], 10);

  const office = parseInt(clean.slice(0, 2), 10);
  if (!(office >= 1 && office <= 21)) return false;
  if (clean.slice(2, 8) === '000000') return false;
  if (clean.slice(8, 10) !== '00') return false;

  const factors = [4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 1; i <= 11; i++) sum += digit(i) * factors[i - 1];
  const resto = sum % 11;
  const resta = 11 - resto;

  let expected: number | null;
  if (resta === 11) expected = 0;
  else if (resta === 10) expected = null;
  else expected = resta;

  if (expected === null) return clean.length === 11;
  if (clean.length === 12) return digit(12) === expected;
  return false;
}

export function formatRUT(input: string): string {
  const clean = (input || '').replace(/\D/g, '');
  if (clean.length !== 12) return input;
  return `${clean.slice(0, 2)}-${clean.slice(2, 8)}-${clean.slice(8, 12)}`;
}

/** Cédula de Identidad: 7-digit body + 1 check digit (DNIC algorithm). */
export function validateCedula(input: string): boolean {
  const clean = (input || '').replace(/\D/g, '');
  if (clean.length < 7 || clean.length > 8) return false;

  const padded = clean.padStart(8, '0');
  const digits = padded.split('').map(Number);
  const weights = [2, 9, 8, 7, 6, 3, 4];

  let sum = 0;
  for (let i = 0; i < 7; i++) sum += (digits[i] * weights[i]) % 10;
  const expected = (10 - (sum % 10)) % 10;

  return digits[7] === expected;
}

export function formatCedula(input: string): string {
  const clean = (input || '').replace(/\D/g, '');
  if (clean.length < 7 || clean.length > 8) return input;
  const padded = clean.padStart(8, '0');
  const body = padded.slice(0, 7).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${body}-${padded.slice(7)}`;
}

/** Accepts either a RUT or a Cédula — used for the single "documento" field a client types in. */
export function validateDocument(input: string): boolean {
  return validateRUT(input) || validateCedula(input);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: 'Pendiente',
  PROCESSING: 'En Proceso',
  COMPLETED: 'Completado',
  CANCELLED: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};
