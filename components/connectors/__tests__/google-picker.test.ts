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
  document.body.style.pointerEvents = '';
  document.getElementById('dalgo-picker-pointer-events')?.remove();
});

/**
 * Every host that opens the Picker does so from inside a Radix modal dialog, and Radix's
 * DismissableLayer sets `document.body { pointer-events: none }` for as long as one is open,
 * re-enabling it only inside its own layer. The Picker appends its DOM to document.body,
 * outside that layer, so it inherits the lock: it renders correctly and then swallows every
 * click and wheel event. These tests pin the escape.
 */
describe('inside a Radix modal (body pointer-events locked)', () => {
  beforeEach(() => {
    document.body.style.pointerEvents = 'none';
  });

  it('lets pointer events through to the Picker while it is open', async () => {
    const calls = installFakePicker();

    const pending = pickSpreadsheet(CONFIG);
    await Promise.resolve();

    expect(document.body.style.pointerEvents).toBe('auto');

    calls.callback!({ action: 'picked', docs: [DOC] });
    await pending;
  });

  // Belt and braces: a rule scoped to the Picker's own containers keeps it clickable even if
  // something re-locks the body mid-flow. `pointer-events: auto` on a descendant overrides an
  // inherited `none`.
  it('scopes a pointer-events rule to the Picker containers', async () => {
    const calls = installFakePicker();

    const pending = pickSpreadsheet(CONFIG);
    await Promise.resolve();
    calls.callback!({ action: 'picked', docs: [DOC] });
    await pending;

    const style = document.getElementById('dalgo-picker-pointer-events');
    expect(style?.textContent).toContain('.picker-dialog');
    expect(style?.textContent).toContain('.picker-dialog-bg');
    expect(style?.textContent).toContain('pointer-events: auto');
  });

  it('restores the modal lock once a sheet is picked', async () => {
    const calls = installFakePicker();

    const pending = pickSpreadsheet(CONFIG);
    await Promise.resolve();
    calls.callback!({ action: 'picked', docs: [DOC] });
    await pending;

    expect(document.body.style.pointerEvents).toBe('none');
  });

  it('restores the modal lock when the Picker is cancelled', async () => {
    const calls = installFakePicker();

    const pending = pickSpreadsheet(CONFIG);
    await Promise.resolve();
    calls.callback!({ action: 'cancel' });
    await expect(pending).rejects.toBeInstanceOf(PickerCancelledError);

    expect(document.body.style.pointerEvents).toBe('none');
  });

  // If the host dialog closed while the Picker was open, Radix already cleared its own lock on
  // unmount. Re-imposing ours would leave the whole page dead to clicks.
  it('does not re-lock the body if the host dialog already released it', async () => {
    const calls = installFakePicker();

    const pending = pickSpreadsheet(CONFIG);
    await Promise.resolve();
    document.body.style.pointerEvents = ''; // Radix unmounted and restored
    calls.callback!({ action: 'picked', docs: [DOC] });
    await pending;

    expect(document.body.style.pointerEvents).toBe('');
  });
});

it('leaves the body alone when there is no modal lock to escape', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  expect(document.body.style.pointerEvents).toBe('');

  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;
  expect(document.body.style.pointerEvents).toBe('');
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

// ViewId.SPREADSHEETS is broader than it sounds: it lists uploaded .xlsx and .csv files
// alongside native Google Sheets. The Airbyte connector reads through the Sheets API, which
// only works on native sheets — so picking an upload yields a source that saves and then fails
// every sync. The mime filter is what keeps them off the list.
it('offers native Google Sheets only, never uploaded xlsx or csv', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  for (const view of calls.views) {
    expect(view.mimeTypes).toContain('application/vnd.google-apps.spreadsheet');
  }
});

// The catch that made this filter look impossible the first time: a mimeTypes list also
// filters FOLDERS out, and in the shared-drives view opening a drive is opening a folder — so
// filtering to sheets alone leaves a tab listing drives it will not let you enter. Naming the
// folder mime type alongside the sheet one keeps the tab navigable while still hiding uploads.
it('keeps folders listed in the shared-drives view so a drive can still be opened', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  const sharedDrives = calls.views.find((v) => v.enableDrives)!;
  expect(sharedDrives.mimeTypes).toContain('application/vnd.google-apps.folder');
});

// My Drive's view is flat, so it has no folders to preserve — and letting them through here
// would only add rows that cannot be opened or selected.
it('does not let folders into the flat My Drive view through the mime filter', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [DOC] });
  await pending;

  const myDrive = calls.views.find((v) => !v.enableDrives)!;
  expect(myDrive.mimeTypes).toBe('application/vnd.google-apps.spreadsheet');
});

it('treats a PICKED action with no document as a cancel', async () => {
  const calls = installFakePicker();

  const pending = pickSpreadsheet(CONFIG);
  await Promise.resolve();
  calls.callback!({ action: 'picked', docs: [] });

  await expect(pending).rejects.toBeInstanceOf(PickerCancelledError);
});
