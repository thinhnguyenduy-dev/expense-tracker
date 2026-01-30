'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/stores/auth-store';

const publicPaths = ['/login', '/register', '/'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, loadUser } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  useEffect(() => {
    if (isLoading) return;

    // Normalize path to ignore locale prefix (e.g. /en/login -> /login)
    // and handle root path correctly
    const normalizedPath = pathname.replace(/^\/(en|vi)/, '') || '/';
    const isPublicPath = publicPaths.includes(normalizedPath);

    if (!isAuthenticated && !isPublicPath) {
      router.push('/login');
    } else if (isAuthenticated && isPublicPath && normalizedPath !== '/') {
      // Allow authenticated users to visit landing page (which is '/')
      // But redirect if they visit login/register
      router.push('/dashboard');
    }
  }, [isLoading, isAuthenticated, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
