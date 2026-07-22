'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { MainLayout } from '@/components/main-layout';
import { AdminGuard } from '@/components/admin/AdminGuard';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { NavigationTitleHandler } from '@/components/navigation-title-handler';
import { Toaster } from 'sonner';
import { usePostHogIdentify } from '@/hooks/usePostHogIdentify';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';

// Define public routes that don't require authentication
const publicRoutes = ['/login', '/forgot-password', '/resetpassword', '/invitations', '/welcome'];

interface ClientLayoutProps {
  children: React.ReactNode;
}

export function ClientLayout({ children }: ClientLayoutProps) {
  usePostHogIdentify();
  useFeatureTracking();
  const pathname = usePathname();
  const isPublicRoute =
    publicRoutes.includes(pathname) ||
    // the admin portal's own sign-in — public, so it is NOT wrapped in AuthGuard/AdminGuard
    // (which would bounce an unauthenticated visitor away before they could sign in)
    pathname === '/admin/login' ||
    pathname.startsWith('/public/dashboard/') ||
    pathname.startsWith('/share/dashboard/') ||
    pathname.startsWith('/share/report/') ||
    pathname.startsWith('/invitations/');

  // Always bypass auth for public dashboard/report routes
  if (
    pathname.startsWith('/share/dashboard/') ||
    pathname.startsWith('/share/report/') ||
    pathname.startsWith('/public/dashboard/')
  ) {
    return (
      <div id="client-layout-public-dashboard">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  if (isPublicRoute) {
    // Public routes (login, etc.) - no auth guard or main layout
    return (
      <div id="client-layout-public-route">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    );
  }

  // Admin portal - authenticated + platform-admin gated, its own sidebar shell.
  // AdminGuard sits inside AuthGuard so children only evaluate once the user is
  // authenticated; AdminGuard then keeps non-admins from ever seeing the shell.
  if (pathname.startsWith('/admin')) {
    return (
      <div id="client-layout-admin-route">
        <NavigationTitleHandler />
        <AuthGuard>
          <AdminGuard>
            <AdminLayout>{children}</AdminLayout>
          </AdminGuard>
          <Toaster richColors position="top-center" />
        </AuthGuard>
      </div>
    );
  }

  // Protected routes - require authentication and include main layout
  return (
    <div id="client-layout-protected-route">
      <NavigationTitleHandler />
      <AuthGuard>
        <MainLayout>{children}</MainLayout>
        <Toaster richColors position="top-center" />
      </AuthGuard>
    </div>
  );
}
