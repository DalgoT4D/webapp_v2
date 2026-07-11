import { TOP_SOURCES, getSourceHelp } from '../wizard-state';

describe('wizard-state', () => {
  it('surfaces only the two custom-UI sources as popular cards', () => {
    expect(TOP_SOURCES.map((s) => s.name)).toEqual(['Google Sheets', 'KoboToolbox']);
  });

  it('returns source-specific help for Google Sheets and a fallback otherwise', () => {
    expect(getSourceHelp('Google Sheets').steps.length).toBeGreaterThan(0);
    expect(getSourceHelp('Some Unknown Source').title).toMatch(/connect/i);
  });

  it('returns Kobo-specific steps, not the generic fallback', () => {
    const help = getSourceHelp('KoboToolbox');
    expect(help.title).toBe('How to connect KoboToolbox');
    expect(help.steps[0].title).toBe('Enter your KoboToolbox login');
    expect(help.steps).toHaveLength(3);
  });
});
