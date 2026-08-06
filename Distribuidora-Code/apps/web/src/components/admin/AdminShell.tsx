'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

/**
 * Envuelve el sidebar + header + contenido para poder compartir el estado de
 * "menú abierto" entre el botón hamburguesa (Header) y el drawer (Sidebar) —
 * layout.tsx es un Server Component (exporta metadata), así que ese estado
 * no puede vivir ahí directamente.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="admin-scope flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
