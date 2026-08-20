/**
 * The Google Picker wrapper. The Picker is Google's own UI, so what matters here is what we
 * hand it (the per-flow token, the app identity, a spreadsheets-only view that can see shared
 * drives) and how we read its verdict back — picked vs closed.
 */

import { pickSpreadsheet, PickerCancelledError } from '../google-picker';

interface FakePickerCalls {
  viewId?: string;
  mimeTypes?: string;
  selectFolderEnabled?: boolean;
  enableDrives?: boolean;
  oauthToken?: string;
  developerKey?: string;
  appId?: string;
  features: string[];
  views: unknown[];
  visible?: boolean;
  callback?: (data: unknown) => void;
}

/** Stand in for the real gapi-loaded `window.google.picker`, recording what we configure. */
function installFakePicker(): FakePickerCalls {
  const calls: FakePickerCalls = { features: [], views: [] };

  class DocsView {
    constructor(viewId: string) {
      calls.viewId = viewId;
    }
    setMimeTypes(mimeTypes: string) {
      calls.mimeTypes = mimeTypes;
      return this;
    }
    setSelectFolderEnabled(enabled: boolean) {
      calls.selectFolderEnabled = enabled;
      return this;
    }
    setEnableDrives(enabled: boolean) {
      calls.enableDrives = enabled;
      return this;
    }
  }

  class PickerBuilder {
    setOAuthToken(token: string) {
      calls.oauthToken = token;
      return this;
    }
    setDeveloperKey(key: string) {
      calls.developerKey = key;
      return this;
    }
    setAppId(appId: string) {
      calls.appId = appId;
      return this;
    }
    setTitle() {
      return this;
    }
    addView(view: unknown) {
      calls.views.push(view);
      return this;
    }
    enableFeature(feature: string) {
      calls.features.push(feature);
      return this;
    }
    setCallback(callback: (data: unknown) => void) {
      calls.callback = callback;
      return this;
    }
    build() {
      return {
        setVisible: (visible: boolean) => {
          calls.visible = visible;
        },
      };
    }
  }

  window.google = {
    picker: {
      DocsView,
      PickerBuilder,
      ViewId: { SPREADSHEETS: 'spreadsheets' },
      Feature: { SUPPORT_DRIVES: 'supportDrives' },
      Action: { PICKED: 'picked', CANCEL: 'cancel' },
    },
  };
  return calls;
}

const CONFIG = { accessToken: 'at-123', apiKey: 'picker-key', appId: '123456789' };
const DOC = {
  id: 'sheet-id',
  name: 'Q3 enrolments',
  url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
};

afterEach(() => {
  delete window.google;
});

it('resolves with the picked spreadsheet', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });

  await expect(pending).resolves.toEqual({
    id: 'sheet-id',
    name: 'Q3 enrolments',
    url: 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
  });
  expect(calls.visible).toBe(true);
});

it('rejects with PickerCancelledError when the user closes it', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'cancel' });

  await expect(pending).rejects.toBeInstanceOf(PickerCancelledError);
});

it('hands the Picker the per-flow token and this app’s identity', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  expect(calls.oauthToken).toBe('at-123');
  expect(calls.developerKey).toBe('picker-key');
  // appId is what ties the drive.file grants the Picker creates to our OAuth client
  expect(calls.appId).toBe('123456789');
});

it('shows spreadsheets only, including those on shared drives', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  expect(calls.viewId).toBe('spreadsheets');
  expect(calls.mimeTypes).toBe('application/vnd.google-apps.spreadsheet');
  expect(calls.selectFolderEnabled).toBe(false);
  expect(calls.enableDrives).toBe(true);
  expect(calls.features).toContain('supportDrives');
});

it('treats a PICKED action with no document as a cancel', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [] });

  await expect(pending).rejects.toBeInstanceOf(PickerCancelledError);
});
