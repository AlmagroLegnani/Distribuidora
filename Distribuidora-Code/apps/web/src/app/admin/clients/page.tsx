'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import {
  api,
  getClientRecurringOrders,
  sendRecurringOrderReminder,
  getClientPurchasePatterns,
  sendProductReminder,
  type ClientRecurringOrder,
  type ClientPurchasePattern,
} from '@/lib/admin/api';
import { formatDate, formatCurrency, STATUS_LABELS, STATUS_BADGE, OrderStatus } from '@/lib/admin/utils';

interface Client {
  id: string;
  rut: string | null;
  cedula: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  accessCode: string | null;
  accessCodeSentAt: string | null;
  active: boolean;
  createdAt: string;
  _count: { orders: number };
}

interface ClientDetail extends Client {
  orders: Array<{
    id: string;
    total: number;
    status: OrderStatus;
    createdAt: string;
    items: Array<{ product: { name: string }; quantity: number }>;
  }>;
}

interface ClientSpecialPrice {
  id: string;
  productId: string;
  productName: string;
  productCode: string | null;
  originalPrice: number;
  discountPercent: number;
  specialPrice: number;
}

interface ProductOption {
  id: string;
  name: string;
  code: string | null;
  price: number;
}

interface ClientForm {
  rut: string;
  cedula: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}

const EMPTY_FORM: ClientForm = { rut: '', cedula: '', name: '', email: '', phone: '', address: '' };

const DAY_NAMES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [showEditForm, setShowEditForm] = useState(false);
  const [editForm, setEditForm] = useState<ClientForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState('');

  const [specialPrices, setSpecialPrices] = useState<ClientSpecialPrice[]>([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [removingPriceId, setRemovingPriceId] = useState<string | null>(null);

  const [recurringOrders, setRecurringOrders] = useState<ClientRecurringOrder[]>([]);
  const [loadingRecurring, setLoadingRecurring] = useState(false);
  const [remindingId, setRemindingId] = useState<string | null>(null);
  const [remindMsg, setRemindMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const [purchasePatterns, setPurchasePatterns] = useState<ClientPurchasePattern[]>([]);
  const [loadingPatterns, setLoadingPatterns] = useState(false);
  const [patternRemindingId, setPatternRemindingId] = useState<string | null>(null);
  const [patternRemindMsg, setPatternRemindMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [showAddDiscount, setShowAddDiscount] = useState(false);
  const [discountProductId, setDiscountProductId] = useState('');
  const [discountPercent, setDiscountPercent] = useState('');
  const [discountSaving, setDiscountSaving] = useState(false);
  const [discountError, setDiscountError] = useState('');

  const fetchClients = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const params = q ? `?search=${encodeURIComponent(q)}` : '';
      const data = await api.get<Client[]>(`/clients${params}`);
      setClients(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  useEffect(() => {
    api
      .get<ProductOption[]>('/products')
      .then(setProducts)
      .catch((err) => console.error(err));
  }, []);

  async function viewDetail(client: Client) {
    setLoadingDetail(true);
    setLoadingPrices(true);
    setLoadingRecurring(true);
    setLoadingPatterns(true);
    setShowAddDiscount(false);
    setShowEditForm(false);
    try {
      const detail = await api.get<ClientDetail>(`/clients/${client.id}`);
      setSelected(detail);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoadingDetail(false);
    }
    try {
      const prices = await api.get<ClientSpecialPrice[]>(`/clients/${client.id}/prices`);
      setSpecialPrices(prices);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPrices(false);
    }
    try {
      const recurring = await getClientRecurringOrders(client.id);
      setRecurringOrders(recurring);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRecurring(false);
    }
    try {
      const patterns = await getClientPurchasePatterns(client.id);
      setPurchasePatterns(patterns);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingPatterns(false);
    }
  }

  async function handleRemind(recurringOrderId: string) {
    if (!selected) return;
    setRemindingId(recurringOrderId);
    setRemindMsg(null);
    try {
      const result = await sendRecurringOrderReminder(selected.id, recurringOrderId);
      setRemindMsg({
        id: recurringOrderId,
        ok: result.sent,
        text: result.sent
          ? 'Recordatorio enviado al celular del cliente.'
          : result.reason || 'No se pudo enviar el recordatorio.',
      });
    } catch (err) {
      setRemindMsg({
        id: recurringOrderId,
        ok: false,
        text: err instanceof Error ? err.message : 'Error al enviar el recordatorio',
      });
    } finally {
      setRemindingId(null);
    }
  }

  async function handlePatternRemind(productId: string) {
    if (!selected) return;
    setPatternRemindingId(productId);
    setPatternRemindMsg(null);
    try {
      const result = await sendProductReminder(selected.id, productId);
      setPatternRemindMsg({
        id: productId,
        ok: result.sent,
        text: result.sent
          ? 'Recordatorio enviado al celular del cliente.'
          : result.reason || 'No se pudo enviar el recordatorio.',
      });
    } catch (err) {
      setPatternRemindMsg({
        id: productId,
        ok: false,
        text: err instanceof Error ? err.message : 'Error al enviar el recordatorio',
      });
    } finally {
      setPatternRemindingId(null);
    }
  }

  async function removeSpecialPrice(productId: string) {
    if (!selected) return;
    setRemovingPriceId(productId);
    try {
      await api.delete(`/clients/${selected.id}/prices/${productId}`);
      setSpecialPrices((prev) => prev.filter((p) => p.productId !== productId));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error al quitar el precio especial');
    } finally {
      setRemovingPriceId(null);
    }
  }

  function openAddDiscount() {
    setDiscountProductId('');
    setDiscountPercent('');
    setDiscountError('');
    setShowAddDiscount(true);
  }

  async function saveDiscount() {
    if (!selected) return;
    const pct = parseFloat(discountPercent);
    if (!discountProductId) {
      setDiscountError('Elegí un producto.');
      return;
    }
    if (isNaN(pct) || pct <= 0 || pct >= 100) {
      setDiscountError('El descuento debe ser un porcentaje entre 0 y 100 (ej: 5 para 5%).');
      return;
    }
    setDiscountSaving(true);
    setDiscountError('');
    try {
      await api.put(`/clients/${selected.id}/prices`, {
        productId: discountProductId,
        discountPercent: pct,
      });
      const prices = await api.get<ClientSpecialPrice[]>(`/clients/${selected.id}/prices`);
      setSpecialPrices(prices);
      setShowAddDiscount(false);
    } catch (err) {
      setDiscountError(err instanceof Error ? err.message : 'Error al guardar el descuento');
    } finally {
      setDiscountSaving(false);
    }
  }

  async function deactivate(client: Client) {
    if (!confirm(`¿Desactivar cliente ${client.rut || client.cedula}?`)) return;
    try {
      await api.delete(`/clients/${client.id}`);
      fetchClients(search);
      if (selected?.id === client.id) setSelected(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    }
  }

  async function createClient(e: FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!form.rut.trim() && !form.cedula.trim()) {
      setFormError('Ingresa el RUT o la Cédula del cliente (al menos uno de los dos).');
      return;
    }

    setCreating(true);
    try {
      await api.post('/clients', {
        rut: form.rut.trim() || null,
        cedula: form.cedula.trim() || null,
        name: form.name.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      });
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchClients(search);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al crear el cliente');
    } finally {
      setCreating(false);
    }
  }

  function openEdit(client: Client) {
    setEditError('');
    setEditForm({
      rut: client.rut || '',
      cedula: client.cedula || '',
      name: client.name || '',
      email: client.email || '',
      phone: client.phone || '',
      address: client.address || '',
    });
    setShowEditForm(true);
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setEditError('');

    if (!editForm.rut.trim() && !editForm.cedula.trim()) {
      setEditError('Ingresa el RUT o la Cédula del cliente (al menos uno de los dos).');
      return;
    }

    setSaving(true);
    try {
      const updated = await api.put<Client>(`/clients/${selected.id}`, {
        rut: editForm.rut.trim() || null,
        cedula: editForm.cedula.trim() || null,
        name: editForm.name.trim() || null,
        email: editForm.email.trim() || null,
        phone: editForm.phone.trim() || null,
        address: editForm.address.trim() || null,
      });
      setSelected({ ...selected, ...updated });
      setShowEditForm(false);
      fetchClients(search);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  }

  async function resendCode(client: Client) {
    setResendingId(client.id);
    setResendMsg('');
    try {
      await api.post(`/clients/${client.id}/resend-code`, {});
      setResendMsg(`Código reenviado a ${client.email}`);
      fetchClients(search);
      if (selected?.id === client.id) viewDetail(client);
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : 'Error al reenviar el código');
    } finally {
      setResendingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500 mt-0.5">{clients.length} cliente(s) activos</p>
        </div>
        <button
          onClick={() => {
            setFormError('');
            setForm(EMPTY_FORM);
            setShowForm(true);
          }}
          className="btn-primary"
        >
          + Agregar cliente
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <h3 className="font-semibold text-gray-900">Nuevo cliente</h3>
          <p className="text-sm text-gray-500 -mt-2">
            Ingresa el RUT o la Cédula (al menos uno de los dos). Se le va a generar y enviar un
            código de acceso a su email.
          </p>
          <form onSubmit={createClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">RUT</label>
              <input
                type="text"
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                placeholder="211234560019"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Si el cliente es una empresa con RUT. Con o sin puntos y guion, da igual.
              </p>
            </div>
            <div>
              <label className="label">Cédula</label>
              <input
                type="text"
                value={form.cedula}
                onChange={(e) => setForm({ ...form, cedula: e.target.value })}
                placeholder="12345678"
                className="input"
              />
              <p className="text-xs text-gray-400 mt-1">
                Si no tiene RUT (almacenes chicos, etc.). Con o sin puntos y guion, da igual.
              </p>
            </div>
            <div>
              <label className="label">Razón Social</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Mi Empresa S.A."
                className="input"
              />
            </div>
            <div>
              <label className="label">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="contacto@empresa.uy"
                className="input"
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+598 99 123 456"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección (opcional)</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Dirección del comercio/almacén, para reparto"
                className="input"
              />
            </div>

            {formError && (
              <div className="sm:col-span-2 text-sm p-2 rounded bg-red-50 text-red-700">
                {formError}
              </div>
            )}

            <div className="sm:col-span-2 flex gap-2">
              <button type="submit" disabled={creating} className="btn-primary">
                {creating ? 'Creando...' : 'Crear y enviar código'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {resendMsg && (
        <div
          className={`text-sm p-3 rounded ${
            resendMsg.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}
        >
          {resendMsg}
        </div>
      )}

      <div className="card p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            fetchClients(e.target.value);
          }}
          placeholder="Buscar por RUT, Cédula, nombre o email..."
          className="input max-w-sm"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Client list */}
        <div className="lg:col-span-2 card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          ) : clients.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No hay clientes.</div>
          ) : (
            <div className="divide-y">
              {clients.map((client) => (
                <div
                  key={client.id}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selected?.id === client.id ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                  }`}
                  onClick={() => viewDetail(client)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-mono text-sm font-semibold">
                        {client.rut || client.cedula}
                      </div>
                      <div className="text-sm text-gray-700 mt-0.5">{client.name || '—'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{client.email || ''}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-gray-500">{client._count.orders} pedido(s)</div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deactivate(client);
                        }}
                        className="text-xs text-red-500 hover:text-red-700 mt-1"
                      >
                        Desactivar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-3">
          {loadingDetail && (
            <div className="card flex items-center justify-center h-40">
              <div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full" />
            </div>
          )}
          {!loadingDetail && !selected && (
            <div className="card p-8 text-center text-gray-400">
              <p>Selecciona un cliente para ver su historial</p>
            </div>
          )}
          {!loadingDetail && selected && (
            <div className="space-y-4">
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">
                    {selected.name || selected.rut || selected.cedula}
                  </h3>
                  <button
                    onClick={() => (showEditForm ? setShowEditForm(false) : openEdit(selected))}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    {showEditForm ? 'Cancelar' : 'Editar'}
                  </button>
                </div>

                {showEditForm ? (
                  <form onSubmit={saveEdit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {editError && (
                      <div className="sm:col-span-2 text-sm p-2 rounded bg-red-50 text-red-700">
                        {editError}
                      </div>
                    )}
                    <div>
                      <label className="label">RUT</label>
                      <input
                        type="text"
                        value={editForm.rut}
                        onChange={(e) => setEditForm({ ...editForm, rut: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Cédula</label>
                      <input
                        type="text"
                        value={editForm.cedula}
                        onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Razón Social</label>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Email</label>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="label">Teléfono</label>
                      <input
                        type="tel"
                        value={editForm.phone}
                        onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="label">Dirección</label>
                      <input
                        type="text"
                        value={editForm.address}
                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                        placeholder="Dirección del comercio/almacén, para reparto"
                        className="input"
                      />
                    </div>
                    <div className="sm:col-span-2 flex gap-2">
                      <button type="submit" disabled={saving} className="btn-primary text-sm">
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowEditForm(false)}
                        className="btn-secondary text-sm"
                      >
                        Cancelar
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {selected.rut && (
                      <div><span className="text-gray-500">RUT:</span> <span className="font-mono">{selected.rut}</span></div>
                    )}
                    {selected.cedula && (
                      <div><span className="text-gray-500">Cédula:</span> <span className="font-mono">{selected.cedula}</span></div>
                    )}
                    <div><span className="text-gray-500">Email:</span> {selected.email || '—'}</div>
                    <div><span className="text-gray-500">Teléfono:</span> {selected.phone || '—'}</div>
                    <div className="col-span-2"><span className="text-gray-500">Dirección:</span> {selected.address || '—'}</div>
                    <div><span className="text-gray-500">Desde:</span> {formatDate(selected.createdAt)}</div>
                  </div>
                )}

                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <div className="text-sm">
                    <span className="text-gray-500">Código de acceso:</span>{' '}
                    {selected.accessCode ? (
                      <>
                        <span className="font-mono font-semibold">{selected.accessCode}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          enviado {selected.accessCodeSentAt ? formatDate(selected.accessCodeSentAt) : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-gray-400">no enviado</span>
                    )}
                  </div>
                  <button
                    onClick={() => resendCode(selected)}
                    disabled={resendingId === selected.id || !selected.email}
                    title={!selected.email ? 'El cliente no tiene email cargado' : ''}
                    className="btn-secondary text-xs"
                  >
                    {resendingId === selected.id ? 'Enviando...' : 'Reenviar código'}
                  </button>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="p-3 border-b flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">
                    Precios especiales {!loadingPrices && `(${specialPrices.length})`}
                  </span>
                  <button onClick={openAddDiscount} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                    + Agregar descuento
                  </button>
                </div>

                {showAddDiscount && (
                  <div className="p-3 border-b bg-gray-50 space-y-2">
                    {discountError && (
                      <div className="text-xs p-2 rounded bg-red-50 text-red-700">{discountError}</div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <select
                        value={discountProductId}
                        onChange={(e) => setDiscountProductId(e.target.value)}
                        className="input text-sm"
                      >
                        <option value="">Elegí un producto...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} {p.code ? `(${p.code})` : ''} — {formatCurrency(p.price)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min={0.01}
                        max={99.99}
                        step={0.1}
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(e.target.value)}
                        placeholder="% de descuento, ej: 5"
                        className="input text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={saveDiscount}
                        disabled={discountSaving}
                        className="btn-primary text-xs"
                      >
                        {discountSaving ? 'Guardando...' : 'Guardar'}
                      </button>
                      <button
                        onClick={() => setShowAddDiscount(false)}
                        className="btn-secondary text-xs"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}

                {loadingPrices ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="animate-spin w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : specialPrices.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">
                    Este cliente no tiene descuentos. Usá &quot;+ Agregar descuento&quot; para darle un %
                    especial en algún producto.
                  </p>
                ) : (
                  <div className="divide-y">
                    {specialPrices.map((sp) => (
                      <div key={sp.id} className="p-3 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {sp.productName}
                          </div>
                          <div className="text-xs text-gray-400">{sp.productCode}</div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full">
                            -{sp.discountPercent}%
                          </span>
                          <span className="text-xs text-gray-400 line-through">
                            {formatCurrency(sp.originalPrice)}
                          </span>
                          <span className="text-sm font-semibold text-purple-700">
                            {formatCurrency(sp.specialPrice)}
                          </span>
                          <button
                            onClick={() => removeSpecialPrice(sp.productId)}
                            disabled={removingPriceId === sp.productId}
                            className="text-xs text-red-500 hover:text-red-700"
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="p-3 border-b text-sm font-medium text-gray-700">
                  Pedidos recurrentes {!loadingRecurring && `(${recurringOrders.length})`}
                </div>
                {loadingRecurring ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="animate-spin w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : recurringOrders.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">
                    Este cliente no tiene pedidos recurrentes configurados.
                  </p>
                ) : (
                  <div className="divide-y">
                    {recurringOrders.map((ro) => (
                      <div key={ro.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-900 capitalize">
                            Todos los {DAY_NAMES[ro.dayOfWeek]}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              ro.active
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-500'
                            }`}
                          >
                            {ro.active ? 'Activo' : 'Pausado'}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {ro.items
                            .map((i) => `${i.product.name} x${i.quantity}`)
                            .join(', ')}
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="text-xs text-gray-400">
                            Última generación:{' '}
                            {ro.lastGeneratedAt ? formatDate(ro.lastGeneratedAt) : 'todavía no se generó'}
                          </div>
                          <button
                            onClick={() => handleRemind(ro.id)}
                            disabled={remindingId === ro.id}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 shrink-0"
                          >
                            {remindingId === ro.id ? 'Enviando...' : '🔔 Recordar'}
                          </button>
                        </div>
                        {remindMsg && remindMsg.id === ro.id && (
                          <div
                            className={`text-xs mt-1.5 px-2 py-1 rounded ${
                              remindMsg.ok ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {remindMsg.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="p-3 border-b">
                  <div className="text-sm font-medium text-gray-700">
                    Patrones de compra detectados {!loadingPatterns && `(${purchasePatterns.length})`}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Productos que pidió 2 veces o más, aunque no haya armado un pedido recurrente.
                  </p>
                </div>
                {loadingPatterns ? (
                  <div className="flex items-center justify-center h-16">
                    <div className="animate-spin w-5 h-5 border-4 border-blue-600 border-t-transparent rounded-full" />
                  </div>
                ) : purchasePatterns.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">
                    Todavía no se detectó ningún patrón de compra repetido para este cliente.
                  </p>
                ) : (
                  <div className="divide-y">
                    {purchasePatterns.map((pp) => (
                      <div key={pp.productId} className="p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-gray-900 truncate">
                              {pp.productName}
                            </div>
                            <div className="text-xs text-gray-400">{pp.productCode}</div>
                          </div>
                          <button
                            onClick={() => handlePatternRemind(pp.productId)}
                            disabled={patternRemindingId === pp.productId}
                            className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50 shrink-0"
                          >
                            {patternRemindingId === pp.productId ? 'Enviando...' : '🔔 Recordar'}
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Pedido {pp.orderCount} veces, en promedio cada {pp.cadenceDays} días — el último
                          hace {pp.daysSinceLast} día{pp.daysSinceLast === 1 ? '' : 's'}.
                        </div>
                        {patternRemindMsg && patternRemindMsg.id === pp.productId && (
                          <div
                            className={`text-xs mt-1.5 px-2 py-1 rounded ${
                              patternRemindMsg.ok
                                ? 'bg-green-50 text-green-700'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {patternRemindMsg.text}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="card overflow-hidden">
                <div className="p-3 border-b text-sm font-medium text-gray-700">
                  Historial de pedidos ({selected.orders.length})
                </div>
                {selected.orders.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">Sin pedidos.</p>
                ) : (
                  <div className="divide-y">
                    {selected.orders.map((order) => (
                      <div key={order.id} className="p-3">
                        <div className="flex justify-between items-center">
                          <span className="font-mono text-xs text-gray-500">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}>
                            {STATUS_LABELS[order.status]}
                          </span>
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{formatDate(order.createdAt)}</div>
                        <div className="text-sm font-semibold mt-1">{formatCurrency(order.total)}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {order.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
