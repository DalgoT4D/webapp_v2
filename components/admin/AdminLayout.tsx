'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Building2, Bell, Flag, ArrowLeft, Shield, LogOut } from 'lucide-react';
import { ComingSoonBadge, ADMIN_PLACEHOLDER_DIM } from '@/components/admin/ComingSoonBadge';
import { apiPost } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface AdminNavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** disabled items render dimmed with a "Coming soon" tag and don't navigate */
  disabled?: boolean;
}

// Home + Organizations + Feature Flags are live (M2, M3). Notifications is still a
// deferred feature (plan.md Milestone 2, not yet built) shown as a placeholder.
const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { title: 'Home', href: '/admin', icon: Home },
  { title: 'Organizations', href: '/admin/organizations', icon: Building2 },
  { title: 'Notifications', href: '/admin/notifications', icon: Bell, disabled: true },
  { title: 'Feature Flags', href: '/admin/feature-flags', icon: Flag },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuthStore();

  /**
   * Sign out of the admin portal. The session is SHARED with the normal product, so this
   * is a full logout everywhere — same endpoint, same store method, same analytics event
   * as the normal app's header menu (components/header.tsx). Nothing admin-specific.
   *
   * Redirect differs from header.tsx by design: that one reacts to authStore's
   * isAuthenticated going false, but nothing sets isAuthenticated TRUE inside the admin
   * portal (only /login and AuthGuard do, and /admin is outside both), so a reactive
   * redirect here would fire on mount and bounce a signed-in admin straight out. Navigate
   * explicitly instead, once the logout has actually happened.
   */
  const handleLogout = async () => {
    try {
      // Call the logout endpoint to clear cookies on server
      await apiPost('/api/logout/', {});
    } catch (error) {
      console.error('Logout API call failed:', error);
      // Continue with logout even if API call fails
    }

    trackEvent(ANALYTICS_EVENTS.USER_LOGGED_OUT);
    logout();
    router.replace('/admin/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-black">
      <aside className="flex w-64 shrink-0 flex-col border-r bg-white dark:bg-neutral-950">
        <div className="flex items-center gap-2 px-6 py-5 border-b">
          <Shield className="h-5 w-5 text-primary" />
          <span className="font-semibold">Admin Portal</span>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {ADMIN_NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
            const Icon = item.icon;

            if (item.disabled) {
              return (
                <div
                  key={item.title}
                  aria-disabled="true"
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm cursor-not-allowed',
                    ADMIN_PLACEHOLDER_DIM
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  <ComingSoonBadge className="ml-auto" />
                </div>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.title}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t px-3 py-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dalgo</span>
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            data-testid="admin-logout"
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            <span>Log out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
