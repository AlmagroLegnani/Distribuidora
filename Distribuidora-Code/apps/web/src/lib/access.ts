export interface StoredAccess {
  rut: string;
  code: string;
}

function storageKey(slug: string): string {
  return `access_${slug}`;
}

export function loadAccess(slug: string): StoredAccess | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(storageKey(slug));
    return stored ? (JSON.parse(stored) as StoredAccess) : null;
  } catch {
    return null;
  }
}

export function saveAccess(slug: string, access: StoredAccess): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(storageKey(slug), JSON.stringify(access));
}

export function clearAccess(slug: string): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(storageKey(slug));
}
