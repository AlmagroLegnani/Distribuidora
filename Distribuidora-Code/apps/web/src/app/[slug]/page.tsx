'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { getProducts, type Product } from '@/lib/api';
import { clearAccess } from '@/lib/access';
import ProductCard from '@/components/ProductCard';

export default function CatalogPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [products, setProducts] = useState<Product[]>([]);
  const [accessVerified, setAccessVerified] = useState(true);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [brand, setBrand] = useState('');
  const [brands, setBrands] = useState<string[]>([]);
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchProducts = useCallback(
    async (q?: string, cat?: string, br?: string) => {
      setLoading(true);
      try {
        const data = await getProducts(slug, q, cat, br);
        setProducts(data.products);
        setAccessVerified(data.accessVerified);
        // Extract categories y marcas disponibles a partir de lo que devolvió el catálogo
        const cats = Array.from(new Set(data.products.map((p) => p.category).filter(Boolean))) as string[];
        setCategories(cats);
        const brs = Array.from(new Set(data.products.map((p) => p.brand).filter(Boolean))) as string[];
        setBrands(brs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [slug]
  );

  function handleReenterCode() {
    clearAccess(slug);
    window.location.reload();
  }

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleSearch(value: string) {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchProducts(value, category, brand), 300);
  }

  function handleCategory(cat: string) {
    setCategory(cat);
    fetchProducts(search, cat, brand);
  }

  function handleBrand(br: string) {
    setBrand(br);
    fetchProducts(search, category, br);
  }

  return (
    <div className="space-y-5">
      {!accessVerified && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800 flex items-center justify-between gap-3 flex-wrap">
          <span>
            No pudimos verificar tu acceso — puede que tu código de acceso haya cambiado. Estás viendo
            precios de lista, sin tus descuentos especiales.
          </span>
          <button
            onClick={handleReenterCode}
            className="text-xs font-semibold text-amber-900 underline hover:no-underline whitespace-nowrap"
          >
            Volver a ingresar tu código
          </button>
        </div>
      )}

      {/* Search & filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
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
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Buscar productos por nombre, código o marca..."
            className="input pl-9"
          />
        </div>
        {brands.length > 0 && (
          <select
            value={brand}
            onChange={(e) => handleBrand(e.target.value)}
            className="input sm:w-52"
          >
            <option value="">Todas las marcas</option>
            {brands.map((br) => (
              <option key={br} value={br}>
                {br}
              </option>
            ))}
          </select>
        )}
        {categories.length > 0 && (
          <select
            value={category}
            onChange={(e) => handleCategory(e.target.value)}
            className="input sm:w-52"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <svg
            className="w-12 h-12 mx-auto text-gray-300 mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
          <p className="font-medium">No se encontraron productos</p>
          {search && (
            <p className="text-sm mt-1">Intenta con otra búsqueda</p>
          )}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">{products.length} producto(s) disponibles</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
