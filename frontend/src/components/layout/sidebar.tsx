'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  Receipt, 
  Tags, 
  LogOut, 
  Menu, 
  X,
  Wallet,
  Repeat,
  Target,
  Settings,
  PiggyBank,
  CircleDollarSign,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useTranslations } from 'next-intl';

export function Sidebar() {
  const t = useTranslations('Sidebar');
  const tCommon = useTranslations('Common');
  
  const navItems = [
    { href: '/dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { href: '/incomes', label: t('incomes'), icon: CircleDollarSign },
    { href: '/jars', label: t('jars'), icon: PiggyBank },
    { href: '/expenses', label: t('expenses'), icon: Receipt },
    { href: '/categories', label: t('categories'), icon: Tags },
    { href: '/recurring-expenses', label: t('recurring'), icon: Repeat },
    { href: '/goals', label: t('goals'), icon: Target },
    { href: '/reports', label: t('reports'), icon: BarChart3 },
    { href: '/settings', label: t('settings'), icon: Settings },
  ];
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "fixed top-4 left-4 z-50 md:hidden text-foreground hover:bg-muted transition-opacity duration-200",
          isMobileOpen ? "opacity-0 pointer-events-none" : "opacity-100"
        )}
        onClick={() => setIsMobileOpen(true)}
      >
        <Menu className="h-6 w-6" />
      </Button>

      {/* Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300',
          'dark:bg-gradient-to-b dark:from-slate-900 dark:to-slate-800',
          'md:translate-x-0',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center justify-between px-6 py-6 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-foreground">ExpenseTracker</span>
            </div>
            {/* Mobile Close Button */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-muted-foreground hover:text-foreground -mr-2"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all',
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-foreground border border-emerald-500/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <item.icon className={cn('h-5 w-5', isActive && 'text-emerald-500')} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3 mb-2">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center text-white font-medium">
                {user?.name?.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <ThemeToggle />
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
              onClick={() => {
                logout();
                router.push('/login');
              }}
            >
              <LogOut className="h-5 w-5" />
              {tCommon('logout')}
            </Button>

          </div>
        </div>
      </aside>
    </>
  );
}
