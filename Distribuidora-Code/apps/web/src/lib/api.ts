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

export interface DistributorListItem {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  categories: string[];
}

export interface SignupPlan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  maxProducts: number | null;
  maxClients: number | null;
  maxOrdersMonth: number | null;
}

export interface SignupResult {
  distributor: { id: string; name: string; slug: string; email: string };
  trialDays: number;
  trialEndsAt: string | null;
  checkoutUrl: string | null;
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
  rut: string
): Promise<{ valid: boolean }> {
  return apiFetch<{ valid: boolean }>(`/public/${slug}/verify-code`, {
    method: 'POST',
    body: JSON.stringify({ code, rut }),
  });
}

export async function getSignupPlans(): Promise<SignupPlan[]> {
  return apiFetch<SignupPlan[]>('/signup/plans');
}

export async function getSignupCategories(): Promise<string[]> {
  return apiFetch<string[]>('/signup/categories');
}

export async function signupDistributor(payload: {
  name: string;
  email: string;
  password: string;
  slug: string;
  phone?: string;
  planId: string;
  categories: string[];
}): Promise<SignupResult> {
  return apiFetch<SignupResult>('/signup', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getClientOrders(
  slug: string,
  rut: string,
  code: string
): Promise<ClientOrder[]> {
  const params = new URLSearchParams({ rut, code });
  return apiFetch<ClientOrder[]>(`/public/${slug}/orders?${params.toString()}`);
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
  rut: string,
  code: string
): Promise<ClientInfo | null> {
  const params = new URLSearchParams({ code });
  return apiFetch<ClientInfo | null>(
    `/public/${slug}/client/${encodeURIComponent(rut)}?${params.toString()}`
  );
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
