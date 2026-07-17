import { notFound } from 'next/navigation';
import { getDistributor } from '@/lib/api';
import { CartProvider } from '@/context/CartContext';
import AccessGate from '@/components/AccessGate';

interface Props {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}

export default async function SlugLayout({ children, params }: Props) {
  const { slug } = await params;

  let distributor;
  try {
    distributor = await getDistributor(slug);
  } catch {
    notFound();
  }

  return (
    <CartProvider slug={slug}>
      {/* AccessGate controla el header: mientras no se verificó RUT/Cédula + código,
          no se debe ver "Mis Pedidos" ni "Carrito" (todavía no hay ningún cliente logueado). */}
      <AccessGate slug={slug} distributor={distributor}>
        {children}
      </AccessGate>
    </CartProvider>
  );
}
