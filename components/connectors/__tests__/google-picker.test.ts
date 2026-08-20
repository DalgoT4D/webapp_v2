/**
 * The Google Picker wrapper. The Picker is Google's own UI, so what matters here is what we
 * hand it (the per-flow token, the app identity, a spreadsheets-only view that can see shared
 * drives) and how we read its verdict back — picked vs closed.
 */

import { pickSpreadsheet, PickerCancelledError } from '../google-picker';

/** What one DocsView was configured with. */
interface FakeView {
  viewId?: string;
  mimeTypes?: string;
  includeFolders?: boolean;
  selectFolderEnabled?: boolean;
  enableDrives?: boolean;
  mode?: string;
}

interface FakePickerCalls {
  oauthToken?: string;
  developerKey?: string;
  appId?: string;
  features: string[];
  views: FakeView[];
  visible?: boolean;
  callback?: (data: unknown) => void;
}

/** Stand in for the real gapi-loaded `window.google.picker`, recording what we configure. */
function installFakePicker(): FakePickerCalls {
  const calls: FakePickerCalls = { features: [], views: [] };

  class DocsView {
    config: FakeView;
    constructor(viewId: string) {
      this.config = { viewId };
    }
    setMimeTypes(mimeTypes: string) {
      this.config.mimeTypes = mimeTypes;
      return this;
    }
    setIncludeFolders(enabled: boolean) {
      this.config.includeFolders = enabled;
      return this;
    }
    setSelectFolderEnabled(enabled: boolean) {
      this.config.selectFolderEnabled = enabled;
      return this;
    }
    setEnableDrives(enabled: boolean) {
      this.config.enableDrives = enabled;
      return this;
    }
    setMode(mode: string) {
      this.config.mode = mode;
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
    addView(view: DocsView) {
      calls.views.push(view.config);
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
      DocsViewMode: { LIST: 'list' },
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

// Two views, not one: a view with setEnableDrives(true) is rooted at the shared drives, so on
// its own it hides My Drive entirely. Users need both tabs.
it('offers My Drive and shared drives as separate views', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  expect(calls.views).toHaveLength(2);
  expect(calls.views.every((v) => v.viewId === 'spreadsheets')).toBe(true);
  expect(calls.views.filter((v) => v.enableDrives)).toHaveLength(1);
  expect(calls.views.filter((v) => !v.enableDrives)).toHaveLength(1);
  expect(calls.features).toContain('supportDrives');
});

// The My Drive view is FLAT — ViewId.SPREADSHEETS lists every sheet the user has, with no
// hierarchy to walk. Putting folders in it renders rows that cannot be opened (no navigation)
// and cannot be selected (selectFolderEnabled false): a list of dead ends, hiding the sheets
// below them. Folders belong only in the shared-drives view, where opening a drive IS opening
// a folder.
it('keeps folders out of the flat My Drive view', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  const myDrive = calls.views.find((v) => !v.enableDrives)!;
  expect(myDrive.includeFolders).toBeUndefined();
});

it('shows folders in the shared-drives view so a drive can be opened, but not selected', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  const sharedDrives = calls.views.find((v) => v.enableDrives)!;
  expect(sharedDrives.includeFolders).toBe(true);
  expect(sharedDrives.selectFolderEnabled).toBe(false);
});

// ViewId.SPREADSHEETS already restricts the view to spreadsheets. Adding a mimeTypes filter on
// top of it also filters out folders, which is what made the view impossible to navigate.
it('does not filter by mime type on top of the spreadsheets view', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  for (const view of calls.views) {
    expect(view.mimeTypes).toBeUndefined();
  }
});

it('treats a PICKED action with no document as a cancel', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [] });

  await expect(pending).rejects.toBeInstanceOf(PickerCancelledError);
});
