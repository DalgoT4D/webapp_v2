/**
 * The Google connect flow under the `drive.file` scope: consent, then the Google Picker.
 *
 * The scope only grants the files the user selects in Google's own Picker, so a spreadsheet
 * link typed by hand is unreadable — picking is not a nicety, it is what creates the grant.
 * That makes "authorized but nothing picked" a failed connect, not a partial one.
 */

import { connectGoogleSpreadsheet } from '../google-oauth-connect';
import { getSourceOAuthConsent, getSourceOAuthPickerConfig } from '@/hooks/api/useSources';
import { openOAuthPopup } from '../oauth-popup';
import { pickSpreadsheet, PickerCancelledError } from '../google-picker';

jest.mock('@/hooks/api/useSources', () => ({
  getSourceOAuthConsent: jest.fn(),
  getSourceOAuthPickerConfig: jest.fn(),
}));
jest.mock('../oauth-popup', () => ({ openOAuthPopup: jest.fn() }));
jest.mock('../google-picker', () => {
  class PickerCancelledError extends Error {}
  return { pickSpreadsheet: jest.fn(), PickerCancelledError };
});

const mockConsent = getSourceOAuthConsent as jest.Mock;
const mockPickerConfig = getSourceOAuthPickerConfig as jest.Mock;
const mockPopup = openOAuthPopup as jest.Mock;
const mockPick = pickSpreadsheet as jest.Mock;

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
