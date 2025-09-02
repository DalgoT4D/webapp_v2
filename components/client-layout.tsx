'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { MainLayout } from '@/components/main-layout';
import { Toaster } from 'sonner';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/signup', '/forgot-password', '/reset-password'];

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  const pathname = usePathname();
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/public/dashboard/') ||
    pathname.startsWith('/share/dashboard/');

  // Always bypass auth for public dashboard routes
  if (pathname.startsWith('/share/dashboard/') || pathname.startsWith('/public/dashboard/')) {
    return (
      <div id="client-layout-public-dashboard">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  if (isPublicRoute) {
    // Public routes (login, signup, etc.) - no auth guard or main layout
    return (
      <div id="client-layout-public-route">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  // Protected routes - require authentication and include main layout
  return (
    <div id="client-layout-protected-route">
      <AuthGuard>
        <MainLayout>{children}</MainLayout>
        <Toaster richColors position="top-center" />
      </AuthGuard>
    </div>
  );
}
