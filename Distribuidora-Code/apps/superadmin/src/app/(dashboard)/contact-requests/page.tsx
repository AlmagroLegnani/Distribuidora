'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';

interface ContactRequest {
  id: string;
  name: string | null;
  email: string;
  phone: string;
  status: 'NEW' | 'CONTACTED' | 'DISCARDED';
  createdAt: string;
}

const STATUS_LABELS: Record<ContactRequest['status'], string> = {
  NEW: 'Nueva',
  CONTACTED: 'Contactada',
  DISCARDED: 'Descartada',
};

const STATUS_STYLES: Record<ContactRequest['status'], string> = {
  NEW: 'bg-amber-100 text-amber-800',
  CONTACTED: 'bg-green-100 text-green-800',
  DISCARDED: 'bg-gray-100 text-gray-600',
};

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('es-UY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function ContactRequestsPage() {
  const [requests, setRequests] = useState<ContactRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'ALL' | ContactRequest['status']>('ALL');

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get<ContactRequest[]>('/contact-requests');
      setRequests(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar las solicitudes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function updateStatus(id: string, status: ContactRequest['status']) {
    setBusyId(id);
    try {
      await api.patch(`/contact-requests/${id}/status`, { status });
      await fetchRequests();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar la solicitud');
    } finally {
      setBusyId(null);
    }
  }

  const newCount = requests.filter((r) => r.status === 'NEW').length;
  const visibleRequests = filter === 'ALL' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Solicitudes de contacto</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Formularios enviados desde el botón &quot;Contactate con nosotros&quot; de la home pública.
          {newCount > 0 && ` ${newCount} sin gestionar.`}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'NEW', 'CONTACTED', 'DISCARDED'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              filter === f
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'border-gray-200 text-gray-600 hover:border-blue-300'
            }`}
          >
            {f === 'ALL' ? 'Todas' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : error ? (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Teléfono</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Fecha</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Estado</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {visibleRequests.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.name || '—'}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${r.email}`} className="text-blue-600 hover:text-blue-700">
                        {r.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <a href={`tel:${r.phone}`} className="text-blue-600 hover:text-blue-700">
                        {r.phone}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                      {r.status !== 'CONTACTED' && (
                        <button
                          onClick={() => updateStatus(r.id, 'CONTACTED')}
                          disabled={busyId === r.id}
                          className="text-xs text-green-700 hover:text-green-800 font-medium"
                        >
                          Marcar contactada
                        </button>
                      )}
                      {r.status !== 'DISCARDED' && (
                        <button
                          onClick={() => updateStatus(r.id, 'DISCARDED')}
                          disabled={busyId === r.id}
                          className="text-xs text-red-600 hover:text-red-700 font-medium"
                        >
                          Descartar
                        </button>
                      )}
                      {r.status !== 'NEW' && (
                        <button
                          onClick={() => updateStatus(r.id, 'NEW')}
                          disabled={busyId === r.id}
                          className="text-xs text-gray-500 hover:text-gray-700 font-medium"
                        >
                          Reabrir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleRequests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      No hay solicitudes {filter !== 'ALL' ? `en estado "${STATUS_LABELS[filter]}"` : 'todavía'}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
