const API_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) ||
  'http://localhost:3001/api';

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
  description: string | null;
  price: number;
  stock: number;
  category: string | null;
  imageUrl: string | null;
}

export interface ClientInfo {
  rut: string;
  name: string | null;
  email: string | null;
  phone: string | null;
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

export async function getProducts(
  slug: string,
  search?: string,
  category?: string
): Promise<Product[]> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (category) params.set('category', category);
  return apiFetch<Product[]>(`/public/${slug}/products?${params.toString()}`);
}

export async function getClientByRut(
  slug: string,
  rut: string
): Promise<ClientInfo | null> {
  return apiFetch<ClientInfo | null>(`/public/${slug}/client/${encodeURIComponent(rut)}`);
}

export async function createOrder(
  slug: string,
  payload: {
    rut: string;
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
