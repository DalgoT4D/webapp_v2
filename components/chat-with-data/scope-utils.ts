/**
 * Gating helpers for dashboard-scoped chat. The backend rejects scoped
 * sessions on dashboards with no chart/KPI components — mirror that check
 * client-side so the button disables instead of erroring.
 */

interface TabComponent {
  type?: string;
  config?: unknown;
}

interface DashboardTabLike {
  id?: string;
  components?: Record<string, TabComponent> | null;
}

const CHATABLE_COMPONENT_TYPES = new Set(['chart', 'kpi']);

export function dashboardHasChatableComponents(
  tabs: DashboardTabLike[] | null | undefined
): boolean {
  return (tabs ?? []).some((tab) =>
    Object.values(tab.components ?? {}).some(
      (component) => component.type !== undefined && CHATABLE_COMPONENT_TYPES.has(component.type)
    )
  );
}
