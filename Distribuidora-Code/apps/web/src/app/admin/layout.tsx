import Sidebar from '@/components/admin/Sidebar';
import Header from '@/components/admin/Header';
import LowStockModal from '@/components/admin/LowStockModal';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="admin-scope flex h-screen overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col ml-64 min-h-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
      <LowStockModal />
    </div>
  );
}
