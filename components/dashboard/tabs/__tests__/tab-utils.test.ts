import {
  createNewTab,
  getDefaultTabsConfig,
  getNextTabNumber,
  initializeTabsData,
  getActiveTabData,
} from '../tab-utils';
import { DashboardTab, DashboardTabsData } from '@/types/dashboard';

describe('createNewTab', () => {
  it('creates a tab with correct title and structure', () => {
    const tab = createNewTab(2);
    expect(tab.title).toBe('Untitled Tab 2');
    expect(tab.layout_config).toEqual([]);
    expect(tab.components).toEqual({});
    expect(tab.id).toMatch(/^tab-/);
  });
});

describe('getDefaultTabsConfig', () => {
  it('returns a single tab with matching activeTabId', () => {
    const config = getDefaultTabsConfig();
    expect(config.tabs).toHaveLength(1);
    expect(config.tabs[0].title).toBe('Untitled Tab 1');
    expect(config.activeTabId).toBe(config.tabs[0].id);
  });
});

describe('getNextTabNumber', () => {
  it('returns 1 for empty tabs', () => {
    expect(getNextTabNumber([])).toBe(1);
  });

  it('returns next number after highest existing tab number', () => {
    const tabs = [
      { ...createNewTab(1), title: 'Untitled Tab 1' },
      { ...createNewTab(2), title: 'Untitled Tab 2' },
    ];
    expect(getNextTabNumber(tabs)).toBe(3);
  });

  it('handles tabs with custom (non-default) titles', () => {
    const tabs = [
      { ...createNewTab(1), title: 'My Custom Tab' },
      { ...createNewTab(2), title: 'Another Tab' },
    ];
    // No numbers extracted, falls back to tabs.length + 1
    expect(getNextTabNumber(tabs)).toBe(3);
  });
});

describe('initializeTabsData', () => {
  it('converts backend tabs array to DashboardTabsData with first tab active', () => {
    const backendTabs: DashboardTab[] = [
      { id: 'tab-1', title: 'Tab 1', layout_config: [], components: {} },
      { id: 'tab-2', title: 'Tab 2', layout_config: [], components: {} },
    ];
    const result = initializeTabsData(backendTabs);
    expect(result.tabs).toEqual(backendTabs);
    expect(result.activeTabId).toBe('tab-1');
  });

  it('returns default config when tabs is empty or undefined', () => {
    expect(initializeTabsData(undefined).tabs).toHaveLength(1);
    expect(initializeTabsData(null).tabs).toHaveLength(1);
    expect(initializeTabsData([]).tabs).toHaveLength(1);
  });
});

describe('getActiveTabData', () => {
  it('returns layout and components from active tab', () => {
    const tabsData: DashboardTabsData = {
      tabs: [
        {
          id: 'tab-1',
          title: 'Tab 1',
          layout_config: [{ i: 'chart-1', x: 0, y: 0, w: 6, h: 4 }],
          components: { 'chart-1': { id: 'chart-1', type: 'chart', config: {} } },
        },
        {
          id: 'tab-2',
          title: 'Tab 2',
          layout_config: [{ i: 'chart-2', x: 0, y: 0, w: 4, h: 3 }],
          components: { 'chart-2': { id: 'chart-2', type: 'text', config: {} } },
        },
      ],
      activeTabId: 'tab-1',
    };

    const result = getActiveTabData(tabsData);
    expect(result.layout).toHaveLength(1);
    expect(result.layout[0].i).toBe('chart-1');
    expect(result.components['chart-1'].type).toBe('chart');

    const resultTab2 = getActiveTabData(tabsData, 'tab-2');
    expect(resultTab2.layout[0].i).toBe('chart-2');
  });

  it('returns empty data when tabsData is null', () => {
    const result = getActiveTabData(null);
    expect(result).toEqual({ layout: [], components: {} });
  });
});
