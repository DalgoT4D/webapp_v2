'use client';

import type { LandingMenuState } from './LandingPageMenu';
import { ViewHeaderCompact } from './ViewHeaderCompact';
import { ViewHeaderFull } from './ViewHeaderFull';

/** The dashboard fields the header shows. */
export interface ViewHeaderDashboard {
  id: number;
  title: string;
  description?: string;
  is_published?: boolean;
  access_level?: 'view' | 'edit';
  public_share_token?: string;
  last_modified_by?: string;
  updated_at?: string;
}

export interface ViewHeaderProps {
  dashboard: ViewHeaderDashboard;
  isFullscreen: boolean;
  /** Always false where the header renders today (the view hides it in public mode) — kept as before. */
  isPublicMode: boolean;
  isReportMode: boolean;
  isLocked: boolean;
  isLockedByOther: boolean;
  lockedBy?: string;
  landing: LandingMenuState;
  canEdit: boolean;
  isDeleting: boolean;
  isRefreshing: boolean;
  onBack: () => void;
  onToggleFullscreen: () => void;
  onShare: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}

/**
 * The dashboard view header. Both variants are always in the DOM; CSS shows one (`lg:`).
 *
 * Today's differences (compact → full), kept as is:
 * 1. Back: icon only, `p-1`, testid `dashboard-view-back-btn-mobile` → icon + "Back",
 *    `dashboard-view-back-btn`. Both hidden in fullscreen.
 * 2. Title `text-lg` → `text-2xl … max-w-md`.
 * 3. Lock badge text "Locked" → "Locked by <user>" / "Locked by you".
 * 4. "Updated by" / "Modified … ago": a separate bordered row → inline after the badges.
 * 5. Description: no testid, one line → testid `dashboard-description`, two lines.
 * 6. Landing menu: see LandingPageMenu (`px-3 py-1`, "-mobile" testids).
 * 7. Fullscreen button `p-1.5`, testid `dashboard-view-fullscreen-btn-mobile` → `…-btn`.
 * 8. Actions: own row (`justify-end`, `suppressShareTestId`) → inline.
 * Both: Request Edit pill, embed dropdown only when `public_share_token` is present (pinned —
 * the API never returns it).
 */
export function DashboardViewHeader(props: ViewHeaderProps) {
  return (
    <div className="bg-white border-b shadow-sm flex-shrink-0">
      <ViewHeaderCompact {...props} />
      <ViewHeaderFull {...props} />
    </div>
  );
}
