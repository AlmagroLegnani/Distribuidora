import type { Metadata } from 'next';
import AdminShell from '@/components/admin/AdminShell';
import LowStockModal from '@/components/admin/LowStockModal';

// Manifiesto propio para /admin, distinto del genérico de /manifest.webmanifest
// que usan los clientes (ver public/admin-manifest.webmanifest). Al instalar
// la app parada acá adentro (o en cualquier página bajo /admin), el ícono
// queda con nombre de "Panel de Distribuidor" y abre directo en /admin, sin
// pasar por la portada de "Soy cliente / Soy distribuidora".
//
// No queda con el nombre de CADA distribuidora en particular: el login usa
// un token en localStorage (no cookies), y el navegador pide este archivo de
// forma anónima al instalar, así que no hay forma de saber quién está
// logueada para personalizarlo más que esto.
export const metadata: Metadata = {
  title: 'Panel de Distribuidor — TuStockApp',
  manifest: '/admin-manifest.webmanifest',
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminShell>{children}</AdminShell>
      <LowStockModal />
    </>
  );
}
