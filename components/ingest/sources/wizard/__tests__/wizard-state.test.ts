import { TOP_SOURCES, getSourceHelp } from '../wizard-state';

describe('wizard-state', () => {
  it('lists the preferred popular sources first, Google Sheets leading', () => {
    expect(TOP_SOURCES.slice(0, 5).map((s) => s.name)).toEqual([
      'Google Sheets',
      'KoboToolbox',
      'mGramSeva',
      'SurveyCTO',
      'CommCare',
    ]);
  });

  it('returns source-specific help for Google Sheets and a fallback otherwise', () => {
    expect(getSourceHelp('Google Sheets').steps.length).toBeGreaterThan(0);
    expect(getSourceHelp('Some Unknown Source').title).toMatch(/connect/i);
  });
});
