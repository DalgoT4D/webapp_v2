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

/** The user closed the Picker without choosing. Distinct from a load/config failure so the
 *  caller can tell "changed their mind" from "the Picker is broken". */
export class PickerCancelledError extends Error {
  constructor(message = 'The Google Picker was closed without choosing a spreadsheet') {
    super(message);
    this.name = 'PickerCancelledError';
  }
}

const GAPI_SCRIPT_SRC = 'https://apis.google.com/js/api.js';
const SPREADSHEET_MIME_TYPE = 'application/vnd.google-apps.spreadsheet';

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

  return new Promise<PickedSpreadsheet>((resolve, reject) => {
    const view = new picker.DocsView(picker.ViewId.SPREADSHEETS)
      .setMimeTypes(SPREADSHEET_MIME_TYPE)
      .setSelectFolderEnabled(false)
      // clients keep shared sheets on shared drives; without this they are invisible here
      .setEnableDrives(true);

    const built = new picker.PickerBuilder()
      .setOAuthToken(config.accessToken)
      .setDeveloperKey(config.apiKey)
      .setAppId(config.appId)
      .setTitle('Choose the spreadsheet for Dalgo to sync')
      .addView(view)
      .enableFeature(picker.Feature.SUPPORT_DRIVES)
      .setCallback((data: any) => {
        if (data.action === picker.Action.PICKED) {
          const doc = data.docs?.[0];
          if (!doc) {
            reject(new PickerCancelledError());
            return;
          }
          resolve({ id: doc.id, name: doc.name, url: doc.url });
        } else if (data.action === picker.Action.CANCEL) {
          reject(new PickerCancelledError());
        }
      })
      .build();

    built.setVisible(true);
  });
}
