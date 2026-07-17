import Link from 'next/link';

interface Distributor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  phone: string | null;
}

/**
 * Header que se muestra mientras el cliente todavía no verificó su RUT/Cédula
 * + código de acceso (ver AccessGate). No debe mostrar "Mis Pedidos" ni
 * "Carrito" — nadie inició sesión todavía, así que no hay pedidos ni carrito
 * de ESTE cliente para mostrar.
 */
export default function PortalHeaderMinimal({
  distributor,
  slug,
}: {
  distributor: Distributor;
  slug: string;
}) {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <Link href={`/${slug}`} className="flex items-center gap-3">
          {distributor.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={distributor.logoUrl}
              alt={distributor.name}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {distributor.name.charAt(0)}
            </div>
          )}
          <span className="font-semibold text-gray-900">{distributor.name}</span>
        </Link>
      </div>
    </header>
  );
}
