import { TOP_SOURCES } from '../wizard-state';

describe('wizard-state', () => {
  it('surfaces the seven common sources as popular quick connects', () => {
    expect(TOP_SOURCES.map((s) => s.name)).toEqual([
      'Google Sheets',
      'KoboToolbox',
      'Salesforce',
      'CommCare',
      'Avni',
      'Airtable',
      'SurveyCTO',
    ]);
  });
});
