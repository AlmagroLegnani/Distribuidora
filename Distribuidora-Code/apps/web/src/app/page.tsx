'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getDistributors, type DistributorListItem } from '@/lib/api';

export default function HomePage() {
  const [distributors, setDistributors] = useState<DistributorListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    getDistributors()
      .then(setDistributors)
      .catch(() => setError('No se pudo cargar el listado de distribuidoras.'))
      .finally(() => setLoading(false));
  }, []);

  const categories = Array.from(new Set(distributors.flatMap((d) => d.categories))).sort();
  const visibleDistributors = activeCategory
    ? distributors.filter((d) => d.categories.includes(activeCategory))
    : distributors;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900">StockApp</h1>
          <p className="text-gray-500 mt-2">
            Selecciona tu distribuidora para ingresar a su catálogo.
          </p>
        </div>

        {!loading && !error && distributors.length > 0 && categories.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 mb-6">
            <button
              onClick={() => setActiveCategory(null)}
              className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                activeCategory === null
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300'
              }`}
            >
              Todos los rubros
            </button>
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeCategory === category
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
              >
                {category}
              </button>
            ))}
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
            No hay distribuidoras en este rubro todavía.
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
                  <div className="text-xs text-gray-400 mt-0.5">Ver catálogo →</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="text-center mt-12 pt-8 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            ¿Sos distribuidor y querés vender con StockApp?{' '}
            <Link href="/signup" className="text-blue-600 hover:text-blue-700 font-medium">
              Registra tu negocio →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
