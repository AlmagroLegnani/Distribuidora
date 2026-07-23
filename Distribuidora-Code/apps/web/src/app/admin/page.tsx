/**
 * "/admin" redirige siempre a "/admin/dashboard", que es donde vive el
 * contenido real (ver ./dashboard/page.tsx).
 *
 * NOTA de la migración: el archivo original (apps/admin/src/app/(dashboard)/page.tsx)
 * tenía, además de este redirect, una segunda función con "export default"
 * duplicado y sin sus imports (useState, api, Link, StatsCard, etc. nunca se
 * importaban ahí) — código muerto/roto que nunca podía ejecutarse ni
 * compilar en un build de producción. No se migró: la funcionalidad real del
 * dashboard ya está completa en ./dashboard/page.tsx, fiel al archivo
 * original que sí funcionaba.
 */
import { redirect } from 'next/navigation';

export default function AdminRootPage() {
  redirect('/admin/dashboard');
}
