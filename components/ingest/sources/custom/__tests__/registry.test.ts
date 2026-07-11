import { getCustomSource } from '../registry';
import { GoogleSheetsForm } from '../GoogleSheetsForm';
import { KoboToolboxForm } from '../KoboToolboxForm';

describe('getCustomSource', () => {
  it('resolves Google Sheets by name', () => {
    expect(getCustomSource('Google Sheets')?.Form).toBe(GoogleSheetsForm);
  });
  it('resolves KoboToolbox by name', () => {
    expect(getCustomSource('KoboToolbox')?.Form).toBe(KoboToolboxForm);
  });
  it('returns null for any other source', () => {
    expect(getCustomSource('Postgres')).toBeNull();
  });
});
