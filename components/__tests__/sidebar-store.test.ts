import { useSidebarStore } from '@/stores/sidebarStore';

const reset = () =>
  useSidebarStore.setState({ collapsed: false, expandedMenus: {}, parentMenuByHref: {} });

describe('useSidebarStore', () => {
  beforeEach(reset);

  describe('revealNavItem', () => {
    it('leaves the icon rail so the nav item is legible', () => {
      useSidebarStore.getState().setCollapsed(true);

      useSidebarStore.getState().revealNavItem('/charts');

      expect(useSidebarStore.getState().collapsed).toBe(false);
    });

    it('opens the parent submenu that owns the href', () => {
      // /transform is a child of Data, and its link isn't rendered at all while Data is closed —
      // the coachmark anchored to it would wait for a selector that never appears.
      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data' });
      useSidebarStore.getState().setCollapsed(true);

      useSidebarStore.getState().revealNavItem('/transform');

      expect(useSidebarStore.getState().collapsed).toBe(false);
      expect(useSidebarStore.getState().expandedMenus.Data).toBe(true);
    });

    it('records no menu state for a top-level href', () => {
      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data' });

      useSidebarStore.getState().revealNavItem('/dashboards');

      expect(useSidebarStore.getState().expandedMenus).toEqual({});
    });

    it('reopens a submenu the user closed by hand', () => {
      useSidebarStore.getState().registerParentMenus({ '/orchestrate': 'Data' });
      useSidebarStore.getState().setMenuExpanded('Data', false);

      useSidebarStore.getState().revealNavItem('/orchestrate');

      expect(useSidebarStore.getState().expandedMenus.Data).toBe(true);
    });
  });

  describe('openMenus', () => {
    it('opens the named parents without touching the others', () => {
      useSidebarStore.getState().setMenuExpanded('Settings', false);

      useSidebarStore.getState().openMenus(['Data']);

      expect(useSidebarStore.getState().expandedMenus).toEqual({ Settings: false, Data: true });
    });

    it('keeps the same object when nothing changes', () => {
      // Called from an effect on every route change — a fresh object each time would wake every
      // subscriber (the whole sidebar) for no change at all.
      useSidebarStore.getState().openMenus(['Data']);
      const before = useSidebarStore.getState().expandedMenus;

      useSidebarStore.getState().openMenus(['Data']);

      expect(useSidebarStore.getState().expandedMenus).toBe(before);
    });
  });

  describe('registerParentMenus', () => {
    it('keeps the same object when the nav tree is unchanged', () => {
      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data' });
      const before = useSidebarStore.getState().parentMenuByHref;

      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data' });

      expect(useSidebarStore.getState().parentMenuByHref).toBe(before);
    });

    it('replaces the map when the nav tree changes', () => {
      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data' });

      useSidebarStore.getState().registerParentMenus({ '/transform': 'Data', '/ingest': 'Data' });

      expect(useSidebarStore.getState().parentMenuByHref).toEqual({
        '/transform': 'Data',
        '/ingest': 'Data',
      });
    });
  });
});
