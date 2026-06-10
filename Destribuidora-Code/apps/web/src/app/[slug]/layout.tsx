import { notFound } from 'next/navigation';
import { getDistributor } from '@/lib/api';
import { CartProvider } from '@/context/CartContext';
import PortalHeader from '@/components/PortalHeader';

interface Props {
  children: React.ReactNode;
  params: { slug: string };
}

export default async function SlugLayout({ children, params }: Props) {
  let distributor;
  try {
    distributor = await getDistributor(params.slug);
  } catch {
    notFound();
  }

  return (
    <CartProvider slug={params.slug}>
      <div className="min-h-screen bg-gray-50">
        <PortalHeader distributor={distributor} slug={params.slug} />
        <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
      </div>
    </CartProvider>
  );
}
