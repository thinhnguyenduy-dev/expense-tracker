import { Sidebar } from '@/components/layout/sidebar';
import { BottomNav } from '@/components/layout/bottom-nav';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar className="hidden md:block" />
      <BottomNav />
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0 transition-all duration-300">
        <div className="p-4 pt-6 md:p-8 md:pt-8">
          {children}
        </div>
      </main>
    </div>
  );
}

