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
  rut: string;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface OrderItemInput {
  productId: string;
  quantity: number;
}

export interface CreateOrderPayload {
  rut: string;
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
    rut: string;
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

// RUT validation utilities
export function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${formattedBody}-${dv}`;
}

export function validateRUT(rut: string): boolean {
  if (!rut || typeof rut !== 'string') return false;
  const clean = rut.replace(/[.\-]/g, '').toUpperCase();
  if (clean.length < 2 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
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
