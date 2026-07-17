/**
 * NOTE: This file intentionally redirects to /dashboard to avoid route conflicts
 * with apps/admin/src/app/page.tsx (which also maps to /).
 *
 * If you get a Next.js build error about conflicting routes, DELETE THIS FILE.
 * The actual dashboard is at: src/app/(dashboard)/dashboard/page.tsx
 */
import { redirect } from 'next/navigation';

export default function DashboardRootPage() {
  redirect('/dashboard');
}


interface DashboardStats {
  totalOrdersToday: number;
  pendingOrders: number;
  processingOrders: number;
  completedOrders: number;
  recentOrders: Array<{
    id: string;
    total: number;
    status: OrderStatus;
    createdAt: string;
    client: { rut: string | null; cedula: string | null; name: string | null };
  }>;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<DashboardStats>('/orders/dashboard')
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Resumen de actividad</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Pedidos Hoy"
          value={stats?.totalOrdersToday ?? 0}
          description="Total del día"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatsCard
          title="Pendientes"
          value={stats?.pendingOrders ?? 0}
          description="Requieren atención"
          color="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatsCard
          title="En Proceso"
          value={stats?.processingOrders ?? 0}
          description="En preparación"
          color="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          }
        />
        <StatsCard
          title="Completados"
          value={stats?.completedOrders ?? 0}
          description="Total histórico"
          color="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* Recent Orders */}
      <div className="card">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Últimos Pedidos</h3>
          <Link href="/orders" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
            Ver todos →
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {stats?.recentOrders.length === 0 && (
            <p className="p-5 text-sm text-gray-500">No hay pedidos aún.</p>
          )}
          {stats?.recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-xs font-mono font-bold text-gray-600">
                  #{order.id.slice(-4).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {order.client.name || order.client.rut || order.client.cedula}
                  </div>
                  <div className="text-xs text-gray-500">{formatDate(order.createdAt)}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_BADGE[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </span>
                <span className="text-sm font-semibold text-gray-900">
                  {formatCurrency(order.total)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link href="/orders" className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900">Ver Pedidos</div>
            <div className="text-xs text-gray-500">Gestionar y actualizar</div>
          </div>
        </Link>
        <Link href="/products" className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-xl text-green-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900">Productos</div>
            <div className="text-xs text-gray-500">Catálogo y stock</div>
          </div>
        </Link>
        <Link href="/clients" className="card p-5 hover:shadow-md transition-shadow flex items-center gap-4">
          <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <div className="font-semibold text-sm text-gray-900">Clientes</div>
            <div className="text-xs text-gray-500">Empresas registradas</div>
          </div>
        </Link>
      </div>
    </div>
  );
}
