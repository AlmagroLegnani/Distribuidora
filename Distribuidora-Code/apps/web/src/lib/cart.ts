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
  return new Intl.NumberFormat('es-UY', {
    style: 'currency',
    currency: 'UYU',
    minimumFractionDigits: 0,
  }).format(amount);
}

/** Uruguayan RUT: 12 digits — 2 (DGI office, 01-21) + 6 (company) + 2 ("00") + 1 + check digit. */
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

/** Uruguayan Cédula de Identidad: 7-digit body + 1 check digit (DNIC algorithm). */
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

/** A client-facing "documento" can be either a RUT or a Cédula — accept either. */
export function validateDocument(input: string): boolean {
  return validateRUT(input) || validateCedula(input);
}

export function formatDocument(input: string): string {
  if (validateRUT(input)) return formatRUT(input);
  if (validateCedula(input)) return formatCedula(input);
  return input;
}
