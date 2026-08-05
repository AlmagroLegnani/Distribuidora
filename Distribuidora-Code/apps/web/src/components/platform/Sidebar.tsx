'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '@/lib/platform/auth';

// NOTA: rutas adaptadas con el prefijo /platform — en apps/superadmin
// (original) eran '/', '/plans', '/contact-requests' sin prefijo, porque esa
// app vivía sola en su propio puerto (3003).
const navItems = [
  { href: '/platform', label: 'Distribuidoras' },
  { href: '/platform/contact-requests', label: 'Solicitudes' },
  { href: '/platform/plans', label: 'Planes' },
  { href: '/platform/account', label: 'Mi cuenta' },
];

export default function PlatformSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-gray-900 text-white flex flex-col z-30">
      <div className="p-6 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-700 rounded-lg flex items-center justify-center font-bold text-sm">
            S
          </div>
          <div>
            <div className="font-semibold text-sm">TuStockApp</div>
            <div className="text-xs text-gray-400">Plataforma</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/platform' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
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
  );
}
