import { TOP_SOURCES } from '../wizard-state';

describe('wizard-state', () => {
  it('surfaces only the two custom-UI sources as popular cards', () => {
    expect(TOP_SOURCES.map((s) => s.name)).toEqual(['Google Sheets', 'KoboToolbox']);
  });
});
