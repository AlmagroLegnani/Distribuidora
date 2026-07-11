import { notFound } from 'next/navigation';
import { getDistributor } from '@/lib/api';
import { CartProvider } from '@/context/CartContext';
import PortalHeader from '@/components/PortalHeader';
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
      <div className="min-h-screen bg-gray-50">
        <PortalHeader distributor={distributor} slug={slug} />
        <main className="max-w-6xl mx-auto px-4 py-6">
          <AccessGate slug={slug} distributorName={distributor.name}>
            {children}
          </AccessGate>
        </main>
      </div>
    </CartProvider>
  );
}
