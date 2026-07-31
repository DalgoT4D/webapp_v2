import { getCustomSource, isGoogleSheetsSource } from '../registry';
import { GoogleSheetsForm } from '../GoogleSheetsForm';
import { KoboToolboxForm } from '../KoboToolboxForm';
import { SOURCE_NAME_GOOGLE_SHEETS, SOURCE_NAME_KOBOTOOLBOX } from '../constants';
import { DestinationSyncMode } from '@/constants/connections';

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

  // A workspace's catalog may spell the connector differently across Airbyte
  // versions; matching must survive case and extra whitespace (same rule as the
  // backend's OAuth registry).
  it.each(['google sheets', 'GOOGLE SHEETS', 'Google  Sheets', '  Google Sheets  '])(
    'resolves Google Sheets from the variant spelling %p',
    (name) => {
      expect(getCustomSource(name)?.Form).toBe(GoogleSheetsForm);
    }
  );

  it('resolves KoboToolbox regardless of case', () => {
    expect(getCustomSource('kobotoolbox')?.Form).toBe(KoboToolboxForm);
  });
});

describe('isGoogleSheetsSource', () => {
  it.each(['Google Sheets', 'google sheets', 'Google  Sheets', '  GOOGLE sheets '])(
    'is true for %p',
    (name) => {
      expect(isGoogleSheetsSource(name)).toBe(true);
    }
  );

  it.each(['KoboToolbox', 'Postgres', 'Google Analytics', ''])('is false for %p', (name) => {
    expect(isGoogleSheetsSource(name)).toBe(false);
  });
});

describe('getCustomSource connectionView', () => {
  it('gives Google Sheets a full-refresh-only, Sheets config', () => {
    const cv = getCustomSource(SOURCE_NAME_GOOGLE_SHEETS)?.connectionView;
    expect(cv).toMatchObject({
      streamNoun: 'Sheets',
      supportsIncremental: false,
      allowedDestModes: [DestinationSyncMode.OVERWRITE, DestinationSyncMode.APPEND],
    });
    expect(cv?.streamHelp).toBeTruthy();
  });

  it('gives KoboToolbox a Forms config with incremental + all dest modes', () => {
    const cv = getCustomSource(SOURCE_NAME_KOBOTOOLBOX)?.connectionView;
    expect(cv).toMatchObject({
      streamNoun: 'Forms',
      supportsIncremental: true,
      allowedDestModes: [
        DestinationSyncMode.OVERWRITE,
        DestinationSyncMode.APPEND,
        DestinationSyncMode.APPEND_DEDUP,
      ],
    });
    expect(cv?.streamHelp).toBeTruthy();
  });

  it('returns null for an unknown source', () => {
    expect(getCustomSource('Postgres')).toBeNull();
  });
});
