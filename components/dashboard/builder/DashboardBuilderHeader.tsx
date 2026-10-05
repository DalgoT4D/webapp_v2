'use client';

import { BuilderHeaderCompact } from './BuilderHeaderCompact';
import { BuilderHeaderFull } from './BuilderHeaderFull';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export interface BuilderHeaderProps {
  title: string;
  isEditingTitle: boolean;
  onTitleChange: (title: string) => void;
  onTitleEditStart: () => void;
  /** Enter or blur in the title input: blank → "Untitled Dashboard", then save. */
  onTitleCommit: () => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  onDescriptionSave: () => void;
  onBack?: () => void;
  onPreview?: () => void;
  isNavigating?: boolean;
  /** Full header "Add Chart" (may redirect to /charts/new — see the builder). */
  onAddChart: () => void;
  /** Compact header "Chart" (always opens the picker). */
  onAddChartCompact: () => void;
  onAddKpi: () => void;
  onAddText: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
  /** Full header only — the compact header has no Save button. */
  onSave: () => void;
}

/**
 * The builder header. Both variants are always in the DOM; CSS shows one (`lg:` = 1024px).
 *
 * Today's differences (compact → full), kept as is:
 * 1. Back: icon only with aria-label "Back" and `p-1` → icon + "Back" text, no aria-label.
 *    Both use testid `dashboard-back-btn`.
 * 2. Full has vertical dividers; compact has none.
 * 3. Title: `text-sm`, testids `dashboard-title-input-mobile` / `dashboard-title-display-mobile`
 *    → `text-lg`, `dashboard-title-input` / `dashboard-title-display`, hover background.
 * 4. Description editor testId `dashboard-description-mobile` → `dashboard-description`.
 * 5. View: icon-only `view-dashboard-mobile-btn` with a `title` → `dashboard-preview-btn` with the
 *    label "View" / "Saving and opening view...", min width 104px.
 * 6. Add chart: compact always opens the picker; full redirects to /charts/new?from=dashboard
 *    when the chart list is an empty array (pinned — never true, see the builder).
 * 7. Labels "Chart" / "KPI" / "Text" (Chart in the default variant) → "Add Chart" / "Add KPI" /
 *    "Add Text" (all outline); testids `dashboard-builder-add-*-btn-mobile` → `add-chart-btn`,
 *    `add-kpi-btn`, `dashboard-builder-add-text-btn`.
 * 8. Compact has no Save button (so no DASHBOARD_UPDATED from it).
 * 9. Save status: compact shows a row (testid `dashboard-save-status-mobile`) only when not idle,
 *    with "Error" on failure; full shows inline items, `saveError || 'Save failed'`, text hidden
 *    below `xl`.
 * Neither variant has a screen-size selector.
 */
export function DashboardBuilderHeader(props: BuilderHeaderProps) {
  return (
    <div className="border-b bg-white flex-shrink-0">
      <BuilderHeaderCompact {...props} />
      <BuilderHeaderFull {...props} />
    </div>
  );
}
