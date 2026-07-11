'use client';

import { usePathname } from 'next/navigation';
import { AuthGuard } from '@/components/auth-guard';
import { MainLayout } from '@/components/main-layout';
import { NavigationTitleHandler } from '@/components/navigation-title-handler';
import { Toaster } from 'sonner';
import { usePostHogIdentify } from '@/hooks/usePostHogIdentify';
import { useFeatureTracking } from '@/hooks/useFeatureTracking';

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
    pathname.startsWith('/invitations/');

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
    return (
      <div id="client-layout-public-route">
        {children}
        <Toaster richColors position="top-center" />
      </div>
    );
  }

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
