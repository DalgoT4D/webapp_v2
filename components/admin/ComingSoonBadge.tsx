import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Single source of truth for the admin portal's "coming soon" placeholder treatment,
 * used by BOTH the sidebar (AdminLayout) and the dashboard stat cards (app/admin/page).
 * Keeping one component means the two surfaces always look like the same deliberate
 * pattern, not two unrelated half-finished features.
 */

/** dimming applied to a placeholder container (sidebar row or dashboard card) */
export const ADMIN_PLACEHOLDER_DIM = 'opacity-60';

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <Badge variant="secondary" className={cn('font-normal', className)}>
      Coming soon
    </Badge>
  );
}
