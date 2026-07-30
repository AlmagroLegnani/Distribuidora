'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDistributors, type DistributorListItem } from '@/lib/api';

export default function DistribuidorasPage() {
  const [distributors, setDistributors] = useState<DistributorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');

  useEffect(() => {
    getDistributors()
      .then(setDistributors)
      .catch(() => setError('No se pudo cargar el listado de distribuidoras.'))
      .finally(() => setLoading(false));
  }, []);

  // Solo mostramos en el desplegable las ciudades que efectivamente tienen
  // alguna distribuidora activa cargada, no las 19 del país entero.
  const availableCities = Array.from(
    new Set(distributors.map((d) => d.city).filter((c): c is string => Boolean(c)))
  ).sort((a, b) => a.localeCompare(b, 'es'));

  const visibleDistributors = distributors.filter((d) => {
    const matchesSearch = search.trim()
      ? d.name.toLowerCase().includes(search.trim().toLowerCase())
      : true;
    const matchesCity = city ? d.city === city : true;
    return matchesSearch && matchesCity;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 mt-4">Elegí tu distribuidora</h1>
          <p className="text-gray-500 mt-2">
            Seleccioná la distribuidora a la que sos cliente para ver su catálogo y stock.
          </p>
        </div>

        {!loading && !error && distributors.length > 0 && (
          <div className="max-w-sm mx-auto mb-8 space-y-3">
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar distribuidora por nombre..."
                className="input pl-9"
                autoFocus
              />
            </div>
            {availableCities.length > 0 && (
              <select value={city} onChange={(e) => setCity(e.target.value)} className="input">
                <option value="">Todas las ciudades</option>
                {availableCities.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : error ? (
          <div className="text-center text-sm text-red-600">{error}</div>
        ) : distributors.length === 0 ? (
          <div className="text-center text-sm text-gray-500">
            Todavía no hay distribuidoras disponibles.
          </div>
        ) : visibleDistributors.length === 0 ? (
          <div className="text-center text-sm text-gray-500">
            No encontramos ninguna distribuidora con ese nombre{city ? ` en ${city}` : ''}.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {visibleDistributors.map((d) => (
              <Link
                key={d.id}
                href={`/${d.slug}`}
                className="card p-5 flex items-center gap-4 hover:shadow-md hover:border-blue-200 transition-all"
              >
                {d.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={d.logoUrl}
                    alt={d.name}
                    className="w-12 h-12 rounded-xl object-contain bg-gray-50 border border-gray-100"
                  />
                ) : (
                  <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {d.name.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-gray-900">{d.name}</div>
                  {d.city && <div className="text-xs text-gray-500 mt-0.5">{d.city}</div>}
                  <div className="text-xs text-gray-400 mt-0.5">Ver catálogo →</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
