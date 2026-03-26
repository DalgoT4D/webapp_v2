import { createNewTab, getDefaultTabsConfig, getNextTabNumber } from '../tab-utils';

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
