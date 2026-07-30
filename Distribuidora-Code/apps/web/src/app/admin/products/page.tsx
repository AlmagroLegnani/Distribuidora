'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/lib/admin/api';
import { formatCurrency } from '@/lib/admin/utils';

type IvaType = 'BASICA' | 'MINIMA';

const IVA_LABELS: Record<IvaType, string> = {
  BASICA: 'Básica (22%)',
  MINIMA: 'Mínima (10%)',
};

interface Product {
  id: string;
  name: string;
  code: string | null;
  brand: string | null;
  description: string | null;
  price: number;
  ivaType: IvaType;
  stock: number;
  category: string | null;
  active: boolean;
}

interface ProductFormData {
  name: string;
  code: string;
  brand: string;
  description: string;
  price: string;
  ivaType: IvaType;
  stock: string;
  category: string;
}

const EMPTY_FORM: ProductFormData = {
  name: '',
  code: '',
  brand: '',
  description: '',
  price: '',
  ivaType: 'BASICA',
  stock: '',
  category: '',
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [inlineStock, setInlineStock] = useState<Record<string, string>>({});
  const [updatingStock, setUpdatingStock] = useState<string | null>(null);
  const searchTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

  const fetchProducts = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const data = await api.get<Product[]>(`/products${params}`);
      setProducts(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  function handleSearchChange(value: string) {
    setSearch(value);
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchProducts(value), 350);
  }

  function openCreate() {
    setEditProduct(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditProduct(product);
    setForm({
      name: product.name,
      code: product.code || '',
      brand: product.brand || '',
      description: product.description || '',
      price: String(product.price),
      ivaType: product.ivaType,
      stock: String(product.stock),
      category: product.category || '',
    });
    setFormError('');
    setShowModal(true);
  }

  async function handleSave() {
    setFormError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        code: form.code || null,
        brand: form.brand || null,
        description: form.description || null,
        price: parseFloat(form.price),
        ivaType: form.ivaType,
        stock: parseInt(form.stock, 10),
        category: form.category || null,
      };

      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }

      setShowModal(false);
      fetchProducts(search);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!confirm(`¿Eliminar "${product.name}"?`)) return;
    try {
      await api.delete(`/products/${product.id}`);
      fetchProducts(search);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al eliminar');
    }
  }

  async function handleInlineStockSave(productId: string) {
    const val = parseInt(inlineStock[productId], 10);
    if (isNaN(val) || val < 0) return;
    setUpdatingStock(productId);
    try {
      await api.patch(`/products/${productId}/stock`, { stock: val });
      setProducts((prev) =>
        prev.map((p) => (p.id === productId ? { ...p, stock: val } : p))
      );
      setInlineStock((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al actualizar stock');
    } finally {
      setUpdatingStock(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Productos</h2>
          <p className="text-sm text-gray-500 mt-0.5">{products.length} producto(s)</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          + Nuevo Producto
        </button>
      </div>

      {/* Search */}
      <div className="card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Buscar por nombre, código o marca..."
          className="input max-w-sm"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No hay productos.</p>
            <button onClick={openCreate} className="btn-primary mt-4">
              + Crear primer producto
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Marca</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Código</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Categoría</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">IVA</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Precio</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Stock</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {products.map((product) => {
                  const editing = product.id in inlineStock;
                  return (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-gray-600">{product.brand || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">
                        {product.code || '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{product.category || '—'}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{IVA_LABELS[product.ivaType]}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(product.price)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {editing ? (
                            <>
                              <input
                                type="number"
                                min={0}
                                value={inlineStock[product.id]}
                                onChange={(e) =>
                                  setInlineStock((prev) => ({
                                    ...prev,
                                    [product.id]: e.target.value,
                                  }))
                                }
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleInlineStockSave(product.id);
                                  if (e.key === 'Escape')
                                    setInlineStock((prev) => {
                                      const next = { ...prev };
                                      delete next[product.id];
                                      return next;
                                    });
                                }}
                                className="input w-20 text-center py-1"
                                autoFocus
                              />
                              <button
                                onClick={() => handleInlineStockSave(product.id)}
                                disabled={updatingStock === product.id}
                                className="text-green-600 hover:text-green-700 text-xs"
                              >
                                ✓
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() =>
                                setInlineStock((prev) => ({
                                  ...prev,
                                  [product.id]: String(product.stock),
                                }))
                              }
                              className={`px-2 py-0.5 rounded text-xs font-semibold transition-colors ${
                                product.stock === 0
                                  ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                  : product.stock < 10
                                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                                  : 'bg-green-100 text-green-700 hover:bg-green-200'
                              }`}
                              title="Click para editar stock"
                            >
                              {product.stock}
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openEdit(product)}
                            className="text-blue-600 hover:text-blue-700 text-xs font-medium"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-xl">
            <div className="flex items-center justify-between p-5 border-b">
              <h3 className="font-semibold text-gray-900">
                {editProduct ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            <div className="p-5 space-y-4">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="label">Nombre *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="input"
                    placeholder="Harina Blanca 1kg"
                  />
                </div>
                <div>
                  <label className="label">Código</label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    className="input"
                    placeholder="PROD-001"
                  />
                </div>
                <div>
                  <label className="label">Marca</label>
                  <input
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    className="input"
                    placeholder="Ej: Cololo, Conaprole..."
                  />
                </div>
                <div>
                  <label className="label">Categoría</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="input"
                    placeholder="Abarrotes"
                  />
                </div>
                <div>
                  <label className="label">Precio *</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className="input"
                    placeholder="1200"
                  />
                  <p className="text-xs text-gray-400 mt-1">Precio final, IVA incluido.</p>
                </div>
                <div>
                  <label className="label">IVA *</label>
                  <select
                    value={form.ivaType}
                    onChange={(e) => setForm({ ...form, ivaType: e.target.value as IvaType })}
                    className="input"
                  >
                    <option value="BASICA">Básica (22%)</option>
                    <option value="MINIMA">Mínima (10%)</option>
                  </select>
                </div>
                <div>
                  <label className="label">Stock *</label>
                  <input
                    type="number"
                    min={0}
                    value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: e.target.value })}
                    className="input"
                    placeholder="100"
                  />
                </div>
                <div className="col-span-2">
                  <label className="label">Descripción</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="input resize-none"
                    rows={2}
                    placeholder="Descripción del producto..."
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t">
              <button onClick={() => setShowModal(false)} className="btn-secondary">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving ? 'Guardando...' : editProduct ? 'Guardar cambios' : 'Crear producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
