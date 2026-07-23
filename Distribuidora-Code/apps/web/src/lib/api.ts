import { loadAccess } from './access';

// En el navegador usamos ruta relativa: Next.js la reenvía al backend interno
// vía rewrites (ver next.config.js), sin necesidad de conocer la URL real de
// la API. Pero este módulo también se usa desde Server Components (ej.
// [slug]/layout.tsx) — ahí el fetch corre en el servidor de Next, donde una
// URL relativa no se puede resolver (no hay "mismo origen" implícito), así
// que en ese caso pegamos directo a la API interna, sin pasar por el rewrite.
const API_URL =
  typeof window === 'undefined'
    ? `${process.env.INTERNAL_API_URL || 'http://localhost:3001'}/api`
    : '/api';

export interface Distributor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
}

export interface Product {
  id: string;
  name: string;
  code: string | null;
  brand: string | null;
  description: string | null;
  price: number;
  /** Precio de lista original, solo presente cuando este cliente tiene un precio especial (price ya viene con el descuento aplicado). */
  originalPrice: number | null;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export interface ClientInfo {
  rut: string | null;
  cedula: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
}

export interface DistributorListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  categories: string[];
}

export interface ClientOrder {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  notes: string | null;
  items: Array<{
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: { name: string; code: string | null };
  }>;
}

export interface OrderResult {
  id: string;
  total: number;
  status: string;
  createdAt: string;
  client: ClientInfo;
  items: Array<{
    quantity: number;
    unitPrice: number;
    subtotal: number;
    product: { name: string; code: string | null };
  }>;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return res.json();
}

export async function getDistributor(slug: string): Promise<Distributor> {
  return apiFetch<Distributor>(`/public/${slug}`);
}

export async function getDistributors(category?: string): Promise<DistributorListItem[]> {
  const params = category ? `?${new URLSearchParams({ category }).toString()}` : '';
  return apiFetch<DistributorListItem[]>(`/public/distributors${params}`);
}

export async function verifyAccessCode(
  slug: string,
  code: string,
  documento: string
): Promise<{ valid: boolean; clientName: string | null }> {
  return apiFetch<{ valid: boolean; clientName: string | null }>(`/public/${slug}/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ code, documento }),
  });
}

export async function getClientOrders(
  slug: string,
  documento: string,
  code: string
): Promise<ClientOrder[]> {
  const params = new URLSearchParams({ documento, code });
  return apiFetch<ClientOrder[]>(`/public/${slug}/orders?${params.toString()}`);
}

export async function getProducts(
  slug: string,
  search?: string,
  category?: string,
  brand?: string
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  if (brand) params.set('brand', brand);
  // Si el cliente ya verificó su acceso a esta distribuidora, mandamos su
  // documento/código para que el backend le aplique su precio especial
  // (si tiene uno) y lo muestre resaltado junto al precio de lista.
  const access = loadAccess(slug);
  if (access) {
    params.set('documento', access.documento);
    params.set('code', access.code);
  }
  return apiFetch<Product[]>(`/public/${slug}/products?${params.toString()}`);
}

export async function getClientByDocumento(
  slug: string,
  documento: string,
  code: string
): Promise<ClientInfo | null> {
  const params = new URLSearchParams({ code });
  return apiFetch<ClientInfo | null>(
    `/public/${slug}/client/${encodeURIComponent(documento)}?${params.toString()}`
  );
}

export async function createContactRequest(payload: {
  name?: string;
  email: string;
  phone: string;
}): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/public/contact-requests`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function createOrder(
  slug: string,
  payload: {
    documento: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    notes?: string;
    items: Array<{ productId: string; quantity: number }>;
  }
): Promise<OrderResult> {
  return apiFetch<OrderResult>(`/public/${slug}/orders`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
