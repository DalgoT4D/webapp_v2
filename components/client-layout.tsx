'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { MainLayout } from '@/components/main-layout';
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
    pathname.startsWith('/public/dashboard/') ||
    pathname.startsWith('/share/dashboard/') ||
    pathname.startsWith('/share/report/') ||
    pathname.startsWith('/invitations/') ||
    // OAuth popup callback: it only relays the opaque ref to its opener and closes.
    // It must render bare (no AuthGuard/MainLayout) — otherwise the guard bounces the
    // popup to /login before it can post the ref back.
    pathname.startsWith('/oauth/');

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
