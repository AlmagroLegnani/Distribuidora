'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/platform/auth';

// NOTA: rutas adaptadas con el prefijo /platform — en apps/superadmin
// (original) eran '/', '/plans', '/contact-requests' sin prefijo, porque esa
// app vivía sola en su propio puerto (3003).
const navItems = [
  { href: '/platform', label: 'Distribuidoras' },
  { href: '/platform/balance', label: 'Balance Estadístico' },
  { href: '/platform/contact-requests', label: 'Solicitudes' },
  { href: '/platform/plans', label: 'Planes' },
  { href: '/platform/account', label: 'Mi cuenta' },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function PlatformSidebar({ open, onClose }: Props) {
  const pathname = usePathname();

  return (
    <>
      {/* Fondo oscuro detrás del drawer en mobile — toca afuera para cerrar. En
          desktop (lg+) el sidebar queda siempre fijo y visible, así que esto
          nunca se renderiza ahí. */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 h-full w-64 bg-gray-900 text-white flex flex-col z-40 transform transition-transform duration-200 ease-in-out ${
          open ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center font-bold text-sm">
              S
            </div>
            <div>
              <div className="font-semibold text-sm">TuStockApp</div>
              <div className="text-xs text-gray-400">Plataforma</div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar menú"
            className="lg:hidden text-gray-400 hover:text-white p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== '/platform' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white transition-colors"
          >
            Cerrar Sesión
          </button>
        </div>
      </aside>
    </>
  );
}
