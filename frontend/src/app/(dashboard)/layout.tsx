import { Sidebar } from '@/components/layout/sidebar';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Sidebar />
      <main className="md:ml-64 min-h-screen">
        <div className="p-6 pt-16 md:p-8 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}
