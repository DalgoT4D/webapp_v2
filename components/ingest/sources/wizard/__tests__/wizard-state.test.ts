import { TOP_SOURCES, getSourceHelp } from '../wizard-state';

describe('wizard-state', () => {
  it('lists the popular sources in order, Google Sheets first', () => {
    expect(TOP_SOURCES.map((s) => s.name)).toEqual([
      'Google Sheets',
      'KoboToolbox',
      'CommCare',
      'HubSpot',
      'Airtable',
    ]);
  });

  it('returns source-specific help for Google Sheets and a fallback otherwise', () => {
    expect(getSourceHelp('Google Sheets').steps.length).toBeGreaterThan(0);
    expect(getSourceHelp('Some Unknown Source').title).toMatch(/connect/i);
  });
});
