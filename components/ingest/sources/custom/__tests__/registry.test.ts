import { getCustomSource } from '../registry';
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
