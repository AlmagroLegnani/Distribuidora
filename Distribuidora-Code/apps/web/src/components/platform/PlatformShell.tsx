'use client';

import { useState } from 'react';
import Sidebar from './Sidebar';

/**
 * Envuelve el sidebar + contenido para poder compartir el estado de "menú
 * abierto" entre el botón hamburguesa (barra superior mobile) y el drawer
 * (Sidebar) — layout.tsx queda simple y liviano.
 */
export default function PlatformShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="platform-scope flex h-screen overflow-hidden bg-gray-50">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-h-0 lg:ml-64">
        {/* Barra superior solo en mobile — en desktop el sidebar ya está
            siempre visible, así que no hace falta botón para abrirlo. */}
        <header className="h-14 bg-white border-b border-gray-200 flex items-center px-4 lg:hidden shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menú"
            className="-ml-1 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="ml-3 font-semibold text-gray-900 text-sm">TuStockApp Plataforma</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
