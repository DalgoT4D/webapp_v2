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

  // Admin portal - gated by AdminGuard alone, its own sidebar shell.
  // Deliberately NOT wrapped in AuthGuard: the admin portal runs an independent session
  // (admin_access_token). AuthGuard checks the normal product session via /api/currentuserv2
  // and pushes to /login when it is absent, which would bounce an admin who signed in at
  // /admin/login straight into the normal app's post-login flow. AdminGuard is the gate here —
  // it resolves identity from /api/v1/admin/currentuser and sends non-admins to /admin/login.
  if (pathname.startsWith('/admin')) {
    return (
      <div id="client-layout-admin-route">
        <NavigationTitleHandler />
        <AdminGuard>
          <AdminLayout>{children}</AdminLayout>
        </AdminGuard>
        <Toaster richColors position="top-center" />
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
