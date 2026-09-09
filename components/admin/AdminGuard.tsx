'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminSession } from '@/hooks/api/useAdminPortal';

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
 * Identity comes from useAdminSession (/api/v1/admin/currentuser). That route uses the
 * SHARED session cookie and is gated by @platform_admin_required, so it answers 401 when
 * signed out and 403 for a signed-in non-admin — both arrive here as "error, no data"
 * and are treated identically: send them to the admin sign-in. While it is still
 * resolving we show a loading state — we must never flash the admin sidebar to someone
 * who may not be an admin (access-control edge case, not cosmetic).
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isPlatformAdmin, mutate } = useAdminSession();

  // Nothing cached from before this mount may be trusted. SWR keeps ONE cache for the
  // whole SPA, and on the first render after a remount it replays a cached ERROR as a
  // settled state (isLoading false, no data) even though it is about to refetch — there
  // is no flag that tells the two apart. So the 401 left behind by a pre-sign-in visit
  // to /admin made the guard rule "not an admin" and replace() back to /admin/login
  // before the fresh 200 could land, which is why signing in only appeared to work on
  // the second attempt. Own the read instead: fire it here and stay in the loading state
  // until it settles. (useAdminSession therefore sets revalidateOnMount: false — this is
  // the single read, not a second one.)
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    let active = true;
    // Settled either way: a rejection (401/403) is an answer, and an unreachable
    // backend must not leave the user staring at "Checking access..." forever.
    const settle = () => {
      if (active) {
        setVerified(true);
      }
    };
    void mutate().then(settle, settle);
    return () => {
      active = false;
    };
  }, [mutate]);

  const resolving = !verified;

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
