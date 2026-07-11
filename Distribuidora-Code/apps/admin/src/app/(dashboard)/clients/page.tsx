'use client';

import { useEffect, useState, useCallback, FormEvent } from 'react';
import { api } from '@/lib/api';
import { formatDate, formatCurrency, STATUS_LABELS, STATUS_BADGE, OrderStatus } from '@/lib/utils';

interface Client {
  id: string;
  rut: string;
  name: string | null;
  email: string | null;
  phone: string | null;
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

interface NewClientForm {
  rut: string;
  name: string;
  email: string;
  phone: string;
}

const EMPTY_FORM: NewClientForm = { rut: '', name: '', email: '', phone: '' };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ClientDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewClientForm>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState('');

  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendMsg, setResendMsg] = useState('');

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

  async function viewDetail(client: Client) {
    setLoadingDetail(true);
    try {
      const detail = await api.get<ClientDetail>(`/clients/${client.id}`);
      setSelected(detail);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function deactivate(client: Client) {
    if (!confirm(`¿Desactivar cliente ${client.rut}?`)) return;
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
    setCreating(true);
    try {
      await api.post('/clients', {
        rut: form.rut.trim(),
        name: form.name.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
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
            Se le va a generar y enviar un código de acceso a su email.
          </p>
          <form onSubmit={createClient} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">RUT *</label>
              <input
                type="text"
                required
                value={form.rut}
                onChange={(e) => setForm({ ...form, rut: e.target.value })}
                placeholder="12.345.678-9"
                className="input"
              />
            </div>
            <div>
              <label className="label">Nombre de empresa</label>
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
                placeholder="contacto@empresa.cl"
                className="input"
              />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+56912345678"
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
          placeholder="Buscar por RUT, nombre o email..."
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
                      <div className="font-mono text-sm font-semibold">{client.rut}</div>
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
                <h3 className="font-semibold text-gray-900 mb-3">
                  {selected.name || selected.rut}
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">RUT:</span> <span className="font-mono">{selected.rut}</span></div>
                  <div><span className="text-gray-500">Email:</span> {selected.email || '—'}</div>
                  <div><span className="text-gray-500">Teléfono:</span> {selected.phone || '—'}</div>
                  <div><span className="text-gray-500">Desde:</span> {formatDate(selected.createdAt)}</div>
                </div>

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
