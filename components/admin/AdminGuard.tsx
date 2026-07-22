'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

function AdminGuardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-black">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-lg font-medium">Checking access...</p>
      </div>
    </div>
  );
}

/**
 * Client-side gate for the /admin section.
 *
 * This is UX only — the real enforcement is the backend @platform_admin_required
 * guard on every /api/v1/admin/* route. Its job here is to keep a non-admin from
 * ever *seeing* the admin shell.
 *
 * Identity comes from the admin session endpoint /api/v1/admin/currentuser, which is
 * reachable only with the independent admin_access_token cookie. So a missing/expired
 * admin session (401 -> error, no data) is treated the same as "not an admin": send them
 * to the admin sign-in. While it is still resolving we show a loading state — we must
 * never flash the admin sidebar to someone who may not be an admin (access-control edge
 * case, not cosmetic).
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useSWR('/api/v1/admin/currentuser');

  const resolving = isLoading;
  const isPlatformAdmin = data ? Boolean(data.is_platform_admin) : false;

  useEffect(() => {
    if (!resolving && !isPlatformAdmin) {
      router.replace('/admin/login');
    }
  }, [resolving, isPlatformAdmin, router]);

  // Still resolving who the user is → loading, never a flash of the sidebar.
  if (resolving) {
    return <AdminGuardLoading />;
  }

  // Resolved and not an admin → keep showing loading while the redirect runs;
  // children (the admin shell) must never render.
  if (!isPlatformAdmin) {
    return <AdminGuardLoading />;
  }

  return <>{children}</>;
}
