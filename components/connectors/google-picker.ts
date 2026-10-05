/**
 * Google Picker — how the user hands Dalgo a spreadsheet under the `drive.file` scope.
 *
 * `drive.file` grants access to individual files only, and the grant is created by the user
 * selecting the file in Google's own Picker. A spreadsheet link typed into our form grants
 * nothing, so the Picker is the only way to make a sheet readable: it is part of the
 * authorization, not a convenience.
 *
 * The Picker runs entirely client-side, which is why this is the one place a Google access
 * token exists in the browser. It arrives from the backend per flow (see
 * `getSourceOAuthPickerConfig`), is short-lived, and is never persisted here.
 */

/** A spreadsheet the user selected. `url` is what the Airbyte connector stores — its
 *  `spreadsheet_id` field accepts the sheet's link. */
export interface PickedSpreadsheet {
  id: string;
  name: string;
  url: string;
}

/** Everything the Picker needs, straight from the backend (same GCP project as the OAuth
 *  client). Field names match the Picker builder's setters. */
export interface GooglePickerConfig {
  accessToken: string;
  apiKey: string;
  appId: string;
}

/** Drive's metadata endpoint. `supportsAllDrives` so a sheet on a shared drive resolves too. */
const DRIVE_FILE_METADATA_URL = 'https://www.googleapis.com/drive/v3/files';

/**
 * A spreadsheet's title, read straight from Drive with the Picker's own access token.
 *
 * Only for display. Airbyte stores a sheet's link and never its title, so this is the only way
 * to name the sheet a source already syncs. Under `drive.file` the token can read a file only
 * if that file was handed over in a Picker at some point — true for a sheet this source was
 * given, but not guaranteed to have survived (a revoked grant, a deleted or moved file), so
 * callers must treat a rejection as "no name available" rather than an error worth showing.
 */
export async function fetchSpreadsheetName(
  config: GooglePickerConfig,
  fileId: string
): Promise<string> {
  const url = `${DRIVE_FILE_METADATA_URL}/${encodeURIComponent(fileId)}?fields=name&supportsAllDrives=true`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${config.accessToken}` },
  });
  if (!response.ok) throw new Error(`Drive returned ${response.status} for that spreadsheet`);
  const body = (await response.json()) as { name?: string };
  if (!body.name) throw new Error('Drive returned no name for that spreadsheet');
  return body.name;
}

/** The user closed the Picker without choosing. Distinct from a load/config failure so the
 *  caller can tell "changed their mind" from "the Picker is broken". */
export class PickerCancelledError extends Error {
  constructor(message = 'The Google Picker was closed without choosing a spreadsheet') {
    super(message);
    this.name = 'PickerCancelledError';
  }
}

const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js';

/** A native Google Sheet — NOT an uploaded .xlsx/.csv, which the Sheets API cannot read. */
const SHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';
/** Drive folders. Named in the shared-drives view's filter only so drives stay navigable. */
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

// Escaping the host modal ----------------------------------------------------------------
//
// Every host opens the Picker from inside a Radix `Dialog`, and Radix's DismissableLayer sets
// `document.body { pointer-events: none }` for as long as a modal layer is open, re-enabling
// it only inside its own layer. The Picker appends its DOM straight to document.body — outside
// that layer — so it inherits the lock and silently swallows every click and wheel event: the
// file list renders, and nothing in it responds.
//
// Two defences, because a stuck `pointer-events: none` is invisible and maddening to debug:
//  1. A stylesheet scoped to the Picker's own containers. `pointer-events: auto` on a
//     descendant overrides an inherited `none`, so the Picker stays live no matter what the
//     body says, with no timing dependency on when Google creates its DOM.
//  2. Unlock the body for as long as the Picker is up, then put the lock back. This one does
//     not depend on Google's class names holding still.
const PICKER_POINTER_EVENTS_STYLE_ID = 'dalgo-picker-pointer-events';
const PICKER_CONTAINER_SELECTORS = '.picker-dialog, .picker-dialog-bg';

/**
 * Our own handle on the Picker's outer container, so nothing outside this file has to know
 * Google's class names.
 *
 * The onboarding walkthrough points a coachmark at the Picker (see the `*_sheet_picker` stages),
 * and this container is the only part of it we can address: its contents are a cross-origin
 * iframe. Stamped rather than wrapped because Google appends the dialog straight to
 * document.body, leaving nothing for us to wrap it in.
 */
export const GOOGLE_PICKER_TESTID = 'google-picker-dialog';

/** How long to keep watching for Google's dialog before giving up on the stamp. The Picker's DOM
 *  is created synchronously by `setVisible(true)` in practice, but that is Google's business, so
 *  this observes rather than assumes. Missing the stamp costs a coachmark, never a pick. */
const PICKER_STAMP_TIMEOUT_MS = 10000;

/**
 * Put GOOGLE_PICKER_TESTID on the Picker's container as soon as it exists; returns the teardown.
 *
 * Idempotent and failure-tolerant by design: every exit path (picked, cancelled, open failed)
 * calls the teardown, and a container that never appeared simply leaves nothing to clean up.
 */
function stampPickerContainer(): () => void {
  let observer: MutationObserver | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = () => {
    observer?.disconnect();
    observer = null;
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const stamp = (): boolean => {
    const dialog = document.querySelector<HTMLElement>('.picker-dialog');
    if (!dialog) return false;
    dialog.dataset.testid = GOOGLE_PICKER_TESTID;
    return true;
  };

  if (!stamp()) {
    observer = new MutationObserver(() => {
      if (stamp()) stop();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    timer = setTimeout(stop, PICKER_STAMP_TIMEOUT_MS);
  }

  return stop;
}

function ensurePickerPointerEventsStyle(): void {
  if (document.getElementById(PICKER_POINTER_EVENTS_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = PICKER_POINTER_EVENTS_STYLE_ID;
  style.textContent = `${PICKER_CONTAINER_SELECTORS} { pointer-events: auto !important; }`;
  document.head.appendChild(style);
}

/** Lift a modal's body-level pointer-events lock; returns the undo. No-op when unlocked. */
function unlockBodyPointerEvents(): () => void {
  const { body } = document;
  const locked = body.style.pointerEvents;
  if (locked !== 'none') return () => {};
  body.style.pointerEvents = 'auto';
  return () => {
    // Only re-lock if our own value is still in place. If the host dialog closed while the
    // Picker was open, Radix already restored the body on unmount — re-imposing the lock then
    // would leave the entire page dead to clicks with nothing on screen to explain why.
    if (body.style.pointerEvents === 'auto') body.style.pointerEvents = locked;
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    gapi?: any;
    google?: any;
  }
}

// In-flight/settled loader, so several connect attempts in one page life share one script
// tag. Reset on failure so a transient network error doesn't wedge the Picker for the
// whole session.
let pickerLoader: Promise<void> | null = null;

function loadGapiScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GAPI_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Picker')));
      return;
    }
    const script = document.createElement('script');
    script.src = GAPI_SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google Picker'));
    document.body.appendChild(script);
  });
}

async function loadPicker(): Promise<void> {
  // already there (a previous pick in this page, or the host page preloaded it)
  if (window.google?.picker) return;
  if (!pickerLoader) {
    pickerLoader = (async () => {
      await loadGapiScript();
      await new Promise<void>((resolve, reject) => {
        window.gapi.load('picker', {
          callback: () => resolve(),
          onerror: () => reject(new Error('Failed to load Google Picker')),
        });
      });
    })().catch((err) => {
      pickerLoader = null; // let the next attempt retry rather than reuse the rejection
      throw err;
    });
  }
  return pickerLoader;
}

/**
 * Show the Picker over the current page and resolve with the chosen spreadsheet.
 *
 * Rejects with `PickerCancelledError` if the user closes it without picking — there is no
 * usable half-state to return, since nothing was granted.
 */
export async function pickSpreadsheet(config: GooglePickerConfig): Promise<PickedSpreadsheet> {
  await loadPicker();
  const picker = window.google.picker;

  ensurePickerPointerEventsStyle();
  const relockBody = unlockBodyPointerEvents();
  const stopStamping = stampPickerContainer();
  // Both run on every terminal path, in the same order, so neither the body lock nor the
  // observer can outlive the dialog.
  const teardown = () => {
    stopStamping();
    relockBody();
  };

  return new Promise<PickedSpreadsheet>((resolve, reject) => {
    // Two views, one per tab: `setEnableDrives(true)` re-roots a view at the shared-drive list,
    // so a single view configured that way hides My Drive entirely.
    //
    // Both filter to NATIVE sheets — `ViewId.SPREADSHEETS` also lists uploaded .xlsx/.csv, which
    // the connector's Sheets API cannot read, so picking one saves fine then fails every sync.
    //
    // Folders are where the two tabs diverge, and a mimeTypes filter hides folders unless their
    // mime type is named too:
    // - My Drive is a FLAT list with no hierarchy to walk, so folders there are unopenable,
    //   unselectable rows that push the sheets out of sight. Kept out.
    // - Shared drives: opening a drive IS opening a folder, so without them the tab lists drives
    //   it will not let you enter. Kept in, still not selectable.
    const myDriveView = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setMode(picker.DocsViewMode.LIST)
      .setMimeTypes(SHEET_MIME_TYPE);

    const sharedDrivesView = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setMode(picker.DocsViewMode.LIST)
      .setMimeTypes(`${SHEET_MIME_TYPE},${FOLDER_MIME_TYPE}`)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      // clients keep shared sheets on shared drives, not in My Drive
      .setEnableDrives(true);

    const built = new picker.PickerBuilder()
      .setOAuthToken(config.accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setTitle('Choose the spreadsheet for Dalgo to sync')
      .addView(myDriveView)
      .addView(sharedDrivesView)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((data: any) => {
        // PICKED and CANCEL are the only terminal actions; LOADED and others fire while the
        // dialog is still up, so the lock goes back only on the ones that settle the promise.
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          teardown();
          if (!doc) {
            reject(new PickerCancelledError());
            return;
          }
          resolve({ id: doc.id, name: doc.name, url: doc.url });
        } else if (data.action === picker.Action.CANCEL) {
          teardown();
          reject(new PickerCancelledError());
        }
      })
      .build();

    try {
      built.setVisible(true);
    } catch (err) {
      // never leave the host modal unlocked because the Picker failed to open
      teardown();
      throw err;
    }
  });
}
