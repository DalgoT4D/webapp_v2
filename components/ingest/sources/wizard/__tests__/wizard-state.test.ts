import { WIZARD_STEPS, TOP_SOURCES, getSourceHelp } from '../wizard-state';

describe('wizard-state', () => {
  it('defines the three steps in order', () => {
    expect(WIZARD_STEPS.map((s) => s.id)).toEqual(['select', 'configure', 'connection']);
    expect(WIZARD_STEPS.map((s) => s.label)).toEqual([
      'Select source',
      'Create source',
      'Connection',
    ]);
  });

  it('lists the four top sources in order, Google Sheets first', () => {
    expect(TOP_SOURCES.map((s) => s.name)).toEqual([
      'Google Sheets',
      'KoboToolbox',
      'CommCare',
      'SurveyCTO',
    ]);
  });

  it('returns source-specific help for Google Sheets and a fallback otherwise', () => {
    expect(getSourceHelp('Google Sheets').steps.length).toBeGreaterThan(0);
    expect(getSourceHelp('Some Unknown Source').title).toMatch(/connect/i);
  });
});
