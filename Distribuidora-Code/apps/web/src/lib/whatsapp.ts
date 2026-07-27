/**
 * Arma un link de wa.me a partir del teléfono cargado por la distribuidora.
 * Los números de Uruguay se guardan en distintos formatos (con 0 inicial,
 * con espacios, etc.), así que normalizamos a formato internacional
 * (598 + número sin el 0 inicial) antes de armar el link.
 */
export function buildWhatsAppLink(phone: string, message: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }
  if (!digits.startsWith('598')) {
    digits = `598${digits}`;
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
