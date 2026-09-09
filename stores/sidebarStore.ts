import { create } from 'zustand';

/**
 * The desktop sidebar's collapse + submenu state.
 *
 * Lives in a store rather than in MainLayout's own useState because the trial walkthrough has
 * to open the menu from outside the layout: several coachmark stages point at a sidebar nav
 * link ("now go to Transform", "now go to Orchestrate"), and by the time they fire the sidebar
 * is usually collapsed to the icon rail — the chart/dashboard/canvas pages collapse it on
 * arrival and nothing ever expands it again. A coachmark anchored to a 40px unlabelled icon
 * reads as pointing at nothing, and when the target sits inside the "Data" submenu it isn't
 * rendered at all, so the stage waits for a selector that never appears.
 *
 * MainLayout remains the only writer for ordinary UI (the chevron, the per-route auto-collapse
 * and auto-open). The walkthrough only ever calls revealNavItem/expand — it never collapses
 * anything, so a user not in a walkthrough sees exactly the behaviour they saw before.
 */
interface SidebarState {
  /** Icon-rail mode. */
  collapsed: boolean;
  /**
   * Explicit open/closed per parent menu title. A title absent from this map means "follow the
   * path" (MainLayout falls back to hasActiveChild), which is why it is a partial record and
   * not a boolean per known parent.
   */
  expandedMenus: Record<string, boolean>;
  /**
   * Child href -> the title of the parent menu that owns it, registered by MainLayout from the
   * live nav tree. Derived rather than hard-coded: the tree is filtered by role, feature flags
   * and transform type, so a static map here would drift the moment the nav changes.
   */
  parentMenuByHref: Record<string, string>;
  setCollapsed: (collapsed: boolean) => void;
  toggleCollapsed: () => void;
  setMenuExpanded: (title: string, expanded: boolean) => void;
  /** Open these parents, leaving every other menu's state alone. */
  openMenus: (titles: string[]) => void;
  registerParentMenus: (map: Record<string, string>) => void;
  /**
   * Make the nav link for `href` visible and legible: leave the icon rail, and open the parent
   * submenu that owns it. Used by the walkthrough and the product tour before they anchor a
   * popover to a sidebar item.
   */
  revealNavItem: (href: string) => void;
}

const shallowEqual = (a: Record<string, unknown>, b: Record<string, unknown>): boolean => {
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  return aKeys.every((key) => a[key] === b[key]);
};

export const useSidebarStore = create<SidebarState>((set, get) => ({
  collapsed: false,
  expandedMenus: {},
  parentMenuByHref: {},

  setCollapsed: (collapsed) => {
    if (get().collapsed === collapsed) return;
    set({ collapsed });
  },

  toggleCollapsed: () => set({ collapsed: !get().collapsed }),

  setMenuExpanded: (title, expanded) => {
    if (get().expandedMenus[title] === expanded) return;
    set({ expandedMenus: { ...get().expandedMenus, [title]: expanded } });
  },

  // Guarded so the caller (an effect that runs on every route change) can call it
  // unconditionally without waking every subscriber when nothing actually changed.
  openMenus: (titles) => {
    const current = get().expandedMenus;
    const missing = titles.filter((title) => !current[title]);
    if (missing.length === 0) return;
    const next = { ...current };
    for (const title of missing) next[title] = true;
    set({ expandedMenus: next });
  },

  registerParentMenus: (map) => {
    if (shallowEqual(get().parentMenuByHref, map)) return;
    set({ parentMenuByHref: map });
  },

  revealNavItem: (href) => {
    get().setCollapsed(false);
    const parent = get().parentMenuByHref[href];
    if (parent) get().setMenuExpanded(parent, true);
  },
}));
