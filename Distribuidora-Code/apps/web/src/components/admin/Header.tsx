'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/admin/api';

interface Distributor {
  name: string;
  email: string;
  slug: string;
}

export default function AdminHeader({ title }: { title?: string }) {
  const [distributor, setDistributor] = useState<Distributor | null>(null);

  useEffect(() => {
    api
      .get<Distributor>('/auth/me')
      .then(setDistributor)
      .catch(() => null);
  }, []);

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {title && (
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      )}
      <div className="ml-auto flex items-center gap-3">
        {distributor && (
          <>
            <div className="text-right">
              <div className="text-sm font-medium text-gray-900">{distributor.name}</div>
              <div className="text-xs text-gray-500">{distributor.email}</div>
            </div>
            <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-semibold text-sm">
              {distributor.name.charAt(0).toUpperCase()}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
