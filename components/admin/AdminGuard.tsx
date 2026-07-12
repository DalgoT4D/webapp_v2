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
 * is_platform_admin is read straight from the /currentuserv2 SWR data (shared cache
 * key with AuthGuard, so no extra request) rather than the auth store, to avoid a
 * store-hydration race. While that data is still resolving we show a loading state —
 * we must never flash the admin sidebar to someone who may not be an admin before
 * redirecting them (access-control edge case, not cosmetic).
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data, isLoading } = useSWR('/api/currentuserv2');

  const resolving = isLoading || data === undefined;
  const isPlatformAdmin =
    Array.isArray(data) && data.length > 0 ? Boolean(data[0].is_platform_admin) : false;

  useEffect(() => {
    if (!resolving && !isPlatformAdmin) {
      router.replace('/');
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
