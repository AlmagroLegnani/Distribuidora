'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { formatCurrency, validateDocument, formatDocument } from '@/lib/cart';
import {
  createOrder,
  createRecurringOrder,
  getRecurringOrders,
  setRecurringOrderActive,
  deleteRecurringOrder,
  type RecurringOrder,
} from '@/lib/api';
import { loadAccess } from '@/lib/access';
import { IVA_LABELS } from '@/lib/iva';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export default function CartPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { items, total, updateQuantity, removeItem, clearCart } = useCart();

  const [documento, setDocumento] = useState('');
  const [documentoLocked, setDocumentoLocked] = useState(false);
  const [documentoError, setDocumentoError] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [recurringOrders, setRecurringOrders] = useState<RecurringOrder[]>([]);
  const [showRecurringForm, setShowRecurringForm] = useState(false);
  const [recurringDay, setRecurringDay] = useState(1); // lunes por defecto
  const [savingRecurring, setSavingRecurring] = useState(false);
  const [recurringError, setRecurringError] = useState('');
  const [recurringBusyId, setRecurringBusyId] = useState<string | null>(null);

  useEffect(() => {
    const access = loadAccess(slug);
    if (!access?.documento) return;

    setDocumento(access.documento);
    setDocumentoLocked(true);
  }, [slug]);

  useEffect(() => {
    getRecurringOrders(slug)
      .then(setRecurringOrders)
      .catch(() => null);
  }, [slug]);

  async function handleSaveRecurring() {
    if (items.length === 0) return;
    setSavingRecurring(true);
    setRecurringError('');
    try {
      const created = await createRecurringOrder(
        slug,
        recurringDay,
        items.map((i) => ({ productId: i.productId, quantity: i.quantity }))
      );
      setRecurringOrders((prev) => [created, ...prev]);
      setShowRecurringForm(false);
    } catch (err) {
      setRecurringError(err instanceof Error ? err.message : 'No se pudo guardar el pedido recurrente.');
    } finally {
      setSavingRecurring(false);
    }
  }

  async function handleToggleRecurring(id: string, active: boolean) {
    setRecurringBusyId(id);
    try {
      const updated = await setRecurringOrderActive(slug, id, active);
      setRecurringOrders((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo actualizar.');
    } finally {
      setRecurringBusyId(null);
    }
  }

  async function handleDeleteRecurring(id: string) {
    if (!confirm('¿Eliminar este pedido recurrente?')) return;
    setRecurringBusyId(id);
    try {
      await deleteRecurringOrder(slug, id);
      setRecurringOrders((prev) => prev.filter((r) => r.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'No se pudo eliminar.');
    } finally {
      setRecurringBusyId(null);
    }
  }

  function handleDocumentoChange(value: string) {
    setDocumento(value);
    if (value.length > 2) {
      setDocumentoError(validateDocument(value) ? '' : 'RUT o Cédula inválido');
    } else {
      setDocumentoError('');
    }
  }

  function handleDocumentoBlur() {
    if (documento) {
      setDocumento(formatDocument(documento));
      setDocumentoError(validateDocument(documento) ? '' : 'RUT o Cédula inválido');
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitError('');

    if (!documentoLocked && !validateDocument(documento)) {
      setDocumentoError('Ingresa un RUT o Cédula válido');
      return;
    }

    if (items.length === 0) {
      setSubmitError('El carrito está vacío');
      return;
    }

    setSubmitting(true);
    try {
      const order = await createOrder(slug, {
        documento,
        notes: notes || undefined,
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });

      // Guardamos el pedido completo (items, precios, IVA) para que la
      // pantalla de confirmación pueda mostrar el detalle real en vez de
      // solo el total. No hay endpoint público para reconsultar un pedido
      // puntual sin volver a pasar por la verificación de acceso, así que
      // lo pasamos por sessionStorage en el momento de la redirección.
      try {
        sessionStorage.setItem(`order_${order.id}`, JSON.stringify(order));
      } catch {
        // Si sessionStorage no está disponible (modo privado, cuota, etc.)
        // la pantalla de confirmación cae al detalle mínimo (orderId + total).
      }

      clearCart();
      router.push(`/${slug}/confirm?orderId=${order.id}&total=${order.total}`);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al confirmar el pedido');
    } finally {
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <svg
          className="w-16 h-16 mx-auto text-gray-300 mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
          />
        </svg>
        <h2 className="text-xl font-semibold text-gray-700">Tu carrito está vacío</h2>
        <p className="text-gray-500 mt-2">Agrega productos del catálogo</p>
        <Link href={`/${slug}`} className="btn-primary mt-6 inline-flex">
          Ver catálogo
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/${slug}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Seguir comprando
        </Link>
        <h2 className="text-xl font-bold text-gray-900">Tu Carrito</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items table */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Producto</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Cantidad</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Subtotal</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {items.map((item) => (
                  <tr key={item.productId}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{item.name}</div>
                      {item.code && (
                        <div className="text-xs text-gray-400 font-mono">{item.code}</div>
                      )}
                      <div className="text-xs text-gray-500">{formatCurrency(item.price)} c/u</div>
                      {item.ivaType && IVA_LABELS[item.ivaType] && (
                        <div className="text-[11px] text-gray-400">{IVA_LABELS[item.ivaType]} incluido</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600"
                        >
                          −
                        </button>
                        <span className="w-8 text-center font-medium">{item.quantity}</span>
                        <button
                          onClick={() =>
                            updateQuantity(item.productId, Math.min(item.quantity + 1, item.maxStock))
                          }
                          className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center hover:bg-gray-100 text-gray-600"
                        >
                          +
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatCurrency(item.price * item.quantity)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => removeItem(item.productId)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        aria-label="Eliminar"
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t-2 border-gray-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right font-bold text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-xl text-blue-700">
                    {formatCurrency(total)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 px-4 py-2 border-t border-gray-50">
            Los precios ya incluyen el IVA correspondiente a cada producto.
          </p>
        </div>

        {/* Order form */}
        <div className="card p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Datos de Identificación</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RUT o Cédula <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={documento}
                onChange={(e) => handleDocumentoChange(e.target.value)}
                onBlur={handleDocumentoBlur}
                placeholder="21-123456-0019 ó 1.234.567-8"
                required
                disabled={documentoLocked}
                className={`input ${documentoError ? 'border-red-400 focus:ring-red-400' : ''} ${
                  documentoLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : ''
                }`}
              />
              {documentoLocked ? (
                <p className="text-xs text-gray-400 mt-1">Verificado al ingresar</p>
              ) : (
                documentoError && <p className="text-xs text-red-500 mt-1">{documentoError}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notas</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Indicaciones especiales de entrega..."
                className="input resize-none"
                rows={2}
              />
            </div>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                {submitError}
              </div>
            )}

            <div className="pt-2 border-t border-gray-100">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-600">Total a pagar:</span>
                <span className="font-bold text-blue-700 text-lg">{formatCurrency(total)}</span>
              </div>
              <button
                type="submit"
                disabled={submitting || !!documentoError}
                className="btn-primary w-full py-3 text-base"
              >
                {submitting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Confirmando...
                  </>
                ) : (
                  'Confirmar Pedido'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Pedidos recurrentes — "pedime esto todos los martes" */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="font-semibold text-gray-900">Pedidos recurrentes</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Guardá el carrito de hoy para que se pida solo, todas las semanas, el mismo día.
            </p>
          </div>
          {!showRecurringForm && (
            <button
              onClick={() => setShowRecurringForm(true)}
              className="text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              + Repetir este pedido todas las semanas
            </button>
          )}
        </div>

        {showRecurringForm && (
          <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-sm text-gray-700">Repetir todos los</label>
              <select
                value={recurringDay}
                onChange={(e) => setRecurringDay(Number(e.target.value))}
                className="input py-1.5 text-sm w-auto"
              >
                {DAY_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500">con los {items.length} producto(s) de hoy</span>
            </div>
            {recurringError && <p className="text-xs text-red-600">{recurringError}</p>}
            <div className="flex gap-2">
              <button
                onClick={handleSaveRecurring}
                disabled={savingRecurring}
                className="btn-primary py-1.5 px-4 text-sm disabled:opacity-50"
              >
                {savingRecurring ? 'Guardando...' : 'Guardar'}
              </button>
              <button
                onClick={() => setShowRecurringForm(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {recurringOrders.length > 0 && (
          <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100">
            {recurringOrders.map((r) => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Todos los {DAY_NAMES[r.dayOfWeek].toLowerCase()}
                    {!r.active && (
                      <span className="ml-2 text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
                        Pausado
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.items.map((i) => `${i.product.name} (x${i.quantity})`).join(', ')}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs font-medium">
                  <button
                    onClick={() => handleToggleRecurring(r.id, !r.active)}
                    disabled={recurringBusyId === r.id}
                    className="text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {r.active ? 'Pausar' : 'Reactivar'}
                  </button>
                  <button
                    onClick={() => handleDeleteRecurring(r.id)}
                    disabled={recurringBusyId === r.id}
                    className="text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
