'use client';

import { useState } from 'react';
import { useCart } from '@/context/CartContext';
import { formatCurrency } from '@/lib/cart';
import type { IvaType } from '@/lib/api';

const IVA_LABELS: Record<IvaType, string> = {
  BASICA: 'IVA 22% incluido',
  MINIMA: 'IVA 10% incluido',
};

interface Product {
  id: string;
  name: string;
  code: string | null;
  brand: string | null;
  description: string | null;
  price: number;
  originalPrice?: number | null;
  ivaType: IvaType;
  stock: number;
  category: string | null;
  imageUrl?: string | null;
}

export default function ProductCard({ product }: { product: Product }) {
  const { addItem, items } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  const inCart = items.find((i) => i.productId === product.id);
  const remainingStock = product.stock - (inCart?.quantity ?? 0);

  function handleAdd() {
    if (quantity < 1 || quantity > remainingStock) return;
    addItem({
      productId: product.id,
      name: product.name,
      code: product.code,
      price: product.price,
      ivaType: product.ivaType,
      quantity,
      maxStock: product.stock,
    });
    setQuantity(1);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  }

  return (
    <div className="card p-4 flex flex-col gap-3">
      {/* Foto */}
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.imageUrl}
          alt={product.name}
          className="w-full h-32 object-contain rounded-lg bg-gray-50"
        />
      ) : (
        <div className="w-full h-32 rounded-lg bg-gray-50 flex items-center justify-center">
          <svg className="w-8 h-8 text-gray-200" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
              clipRule="evenodd"
            />
          </svg>
        </div>
      )}

      {/* Header */}
      <div className="flex-1">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight">{product.name}</h3>
            {product.brand && (
              <span className="text-xs text-blue-600 font-medium block">{product.brand}</span>
            )}
          </div>
          <span
            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
              remainingStock === 0
                ? 'bg-red-100 text-red-700'
                : remainingStock <= 5
                ? 'bg-yellow-100 text-yellow-700'
                : 'bg-green-100 text-green-700'
            }`}
          >
            {remainingStock === 0 ? 'Sin stock' : `${remainingStock} disp.`}
          </span>
        </div>
        {product.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{product.description}</p>
        )}
      </div>

      {/* Price */}
      <div>
        <div className="flex items-baseline gap-2 flex-wrap">
          {product.originalPrice != null && (
            <span
              className="text-sm text-gray-400 line-through"
              style={{ textDecoration: 'line-through' }}
            >
              {formatCurrency(product.originalPrice)}
            </span>
          )}
          <span className="text-xl font-bold text-blue-700">{formatCurrency(product.price)}</span>
          {product.originalPrice != null && (
            <span className="text-[10px] font-semibold text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
              precio único
            </span>
          )}
        </div>
        <span className="text-[10px] text-gray-400">{IVA_LABELS[product.ivaType]}</span>
      </div>

      {/* Add to cart */}
      {remainingStock > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center border border-gray-200 rounded-xl overflow-hidden w-full">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="flex-1 h-11 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              max={remainingStock}
              value={quantity}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) setQuantity(Math.min(Math.max(1, val), remainingStock));
              }}
              className="w-14 text-center text-sm font-medium border-0 focus:outline-none shrink-0"
            />
            <button
              onClick={() => setQuantity(Math.min(remainingStock, quantity + 1))}
              className="flex-1 h-11 flex items-center justify-center text-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAdd}
            className={`w-full py-2 text-sm font-medium rounded-xl transition-all ${
              added
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95'
            }`}
          >
            {added ? '✓ Agregado' : 'Agregar'}
          </button>
        </div>
      ) : (
        <div className="text-center text-xs text-gray-400 py-2">Producto agotado</div>
      )}
    </div>
  );
}
