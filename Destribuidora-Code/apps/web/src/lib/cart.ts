export interface CartItem {
  productId: string;
  name: string;
  code: string | null;
  price: number;
  quantity: number;
  maxStock: number;
}

export function loadCart(slug: string): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(`cart_${slug}`);
    return stored ? (JSON.parse(stored) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function saveCart(slug: string, items: CartItem[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`cart_${slug}`, JSON.stringify(items));
}

export function clearCart(slug: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(`cart_${slug}`);
}

export function calcTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function validateRUT(rut: string): boolean {
  if (!rut) return false;
  const clean = rut.replace(/[.\-]/g, '').toUpperCase();
  if (clean.length < 2 || clean.length > 9) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return false;

  let sum = 0;
  let mult = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i], 10) * mult;
    mult = mult === 7 ? 2 : mult + 1;
  }
  const expected = 11 - (sum % 11);
  const expDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expDv;
}

export function formatRUT(rut: string): string {
  const clean = rut.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return rut;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}
