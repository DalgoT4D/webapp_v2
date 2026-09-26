/**
 * The Google connect flow under the `drive.file` scope: consent, then the Google Picker.
 *
 * The scope only grants the files the user selects in Google's own Picker, so a spreadsheet
 * link typed by hand is unreadable — picking is not a nicety, it is what creates the grant.
 * That makes "authorized but nothing picked" a failed connect, not a partial one.
 */

import { connectGoogleSpreadsheet, pickSpreadsheetForRef } from '../google-oauth-connect';
import { getSourceOAuthConsent, getSourceOAuthPickerConfig } from '@/hooks/api/useSources';
import { openOAuthPopup } from '../oauth-popup';
import { pickSpreadsheet, fetchSpreadsheetName, PickerCancelledError } from '../google-picker';

jest.mock('@/hooks/api/useSources', () => ({
  getSourceOAuthConsent: jest.fn(),
  getSourceOAuthPickerConfig: jest.fn(),
}));
jest.mock('../oauth-popup', () => ({ openOAuthPopup: jest.fn() }));
jest.mock('../google-picker', () => {
  class PickerCancelledError extends Error {}
  return { pickSpreadsheet: jest.fn(), fetchSpreadsheetName: jest.fn(), PickerCancelledError };
});

const mockConsent = getSourceOAuthConsent as jest.Mock;
const mockPickerConfig = getSourceOAuthPickerConfig as jest.Mock;
const mockPopup = openOAuthPopup as jest.Mock;
const mockPick = pickSpreadsheet as jest.Mock;
const mockSheetName = fetchSpreadsheetName as jest.Mock;

const PICKER_CONFIG = { accessToken: 'at-123', apiKey: 'key', appId: '123456789' };
const PICKED = {
  id: 'sheet-id',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockConsent.mockResolvedValue({ authUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' });
  mockPopup.mockResolvedValue({ ref: 'ref-abc' });
  mockPickerConfig.mockResolvedValue(PICKER_CONFIG);
  mockPick.mockResolvedValue(PICKED);
});

it('returns the redeem ref and the spreadsheet the user picked', async () => {
  const result = await connectGoogleSpreadsheet('def-id', 'Google Sheets');

  expect(result).toEqual({ ref: 'ref-abc', spreadsheet: PICKED });
  expect(mockConsent).toHaveBeenCalledWith('def-id', 'Google Sheets');
  expect(mockPopup).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?x=1');
});

it('trades the ref for the picker config, so the access token is never held client-side', async () => {
  await connectGoogleSpreadsheet('def-id', 'Google Sheets');

  // the ref comes back from consent, not from the caller — the backend checks ownership
  expect(mockPickerConfig).toHaveBeenCalledWith('Google Sheets', 'ref-abc');
  expect(mockPick).toHaveBeenCalledWith(PICKER_CONFIG);
});

it('opens the picker only after consent — the token comes from that consent', async () => {
  const order: string[] = [];
  mockPopup.mockImplementation(async () => {
    order.push('consent');
    return { ref: 'ref-abc' };
  });
  mockPick.mockImplementation(async () => {
    order.push('pick');
    return PICKED;
  });

  await connectGoogleSpreadsheet('def-id', 'Google Sheets');

  expect(order).toEqual(['consent', 'pick']);
});

it('fails the connect when the user closes the picker without choosing a sheet', async () => {
  mockPick.mockRejectedValue(new PickerCancelledError('cancelled'));

  await expect(connectGoogleSpreadsheet('def-id', 'Google Sheets')).rejects.toThrow(
    'No spreadsheet selected'
  );
});

it('never reaches the picker when consent fails', async () => {
  mockPopup.mockRejectedValue(new Error('Google sign-in was cancelled'));

  await expect(connectGoogleSpreadsheet('def-id', 'Google Sheets')).rejects.toThrow(
    'Google sign-in was cancelled'
  );
  expect(mockPickerConfig).not.toHaveBeenCalled();
  expect(mockPick).not.toHaveBeenCalled();
});

// The previous sheet's TITLE is nowhere in Dalgo: Airbyte stores the link only. Naming it in the
// mismatch warning is worth one Drive metadata call with the token the Picker already used —
// and worth nothing if it fails, so a failure degrades to no name rather than a broken connect.
describe('naming the sheet a source already syncs', () => {
  it('resolves the previous sheet name alongside the pick', async () => {
    mockSheetName.mockResolvedValue('Support Tickets Tracker');

    const result = await connectGoogleSpreadsheet('def-id', 'Google Sheets', {
      previousSheet: 'https://docs.google.com/spreadsheets/d/1previous_sheet_id_2345678/edit',
    });

    expect(result.previousSheetName).toBe('Support Tickets Tracker');
    expect(mockSheetName).toHaveBeenCalledWith(PICKER_CONFIG, '1previous_sheet_id_2345678');
  });

  it('still returns the pick when the name lookup fails', async () => {
    mockSheetName.mockRejectedValue(new Error('404'));

    const result = await connectGoogleSpreadsheet('def-id', 'Google Sheets', {
      previousSheet: 'https://docs.google.com/spreadsheets/d/1previous_sheet_id_2345678/edit',
    });

    expect(result.spreadsheet).toEqual(PICKED);
    expect(result.previousSheetName).toBeUndefined();
  });

  it('asks for no name when the pick IS the sheet the source already syncs', async () => {
    await connectGoogleSpreadsheet('def-id', 'Google Sheets', {
      previousSheet: `https://docs.google.com/spreadsheets/d/${PICKED.id}/edit`,
    });

    // Nothing to warn about, so nothing to name — and no call to spend on it.
    expect(mockSheetName).not.toHaveBeenCalled();
  });

  it('asks for no name when the caller names no previous sheet', async () => {
    await connectGoogleSpreadsheet('def-id', 'Google Sheets');

    expect(mockSheetName).not.toHaveBeenCalled();
  });
});

describe('pickSpreadsheetForRef', () => {
  it('reopens the picker on a ref the caller already holds, without a second consent', async () => {
    const picked = await pickSpreadsheetForRef('Google Sheets', 'ref-abc');

    expect(picked).toEqual(PICKED);
    expect(mockPickerConfig).toHaveBeenCalledWith('Google Sheets', 'ref-abc');
    expect(mockPick).toHaveBeenCalledWith(PICKER_CONFIG);
    // The ref is not consumed server-side, so swapping the sheet costs no consent round-trip.
    expect(mockConsent).not.toHaveBeenCalled();
    expect(mockPopup).not.toHaveBeenCalled();
  });

  it('lets a cancelled picker through as PickerCancelledError, so the caller can keep the current sheet', async () => {
    mockPick.mockRejectedValue(new PickerCancelledError('cancelled'));

    // Unlike the connect flow, a cancel here is a no-op rather than a failed connect: the
    // spreadsheet already chosen stays, so the caller needs to recognise it, not a rewrapped
    // "no spreadsheet selected" error.
    await expect(pickSpreadsheetForRef('Google Sheets', 'ref-abc')).rejects.toThrow(
      PickerCancelledError
    );
  });
});
