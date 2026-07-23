import PlatformSidebar from '@/components/platform/Sidebar';

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="platform-scope flex h-screen overflow-hidden bg-gray-50">
      <PlatformSidebar />
      <div className="flex-1 flex flex-col ml-64 min-h-0">
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
