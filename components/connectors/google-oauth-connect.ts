/**
 * The Google connect flows, shared by every host that offers "Sign in with Google" for a
 * spreadsheet source (the add-source wizard, the legacy source form, and re-authenticate in
 * the edit dialog).
 *
 * Two entry points, one rule: every consent ends at the Picker.
 *
 * 1. `connectGoogleSpreadsheet` — consent -> popup(ref) -> picker config -> pick a spreadsheet.
 *    The pick is not optional: Dalgo asks Google for `drive.file`, which grants only the files
 *    the user selects in the Picker, so a flow that ends without one leaves us authorized to
 *    read nothing. Callers get either a ref AND a spreadsheet, or an error — never a ref on
 *    its own. This runs for re-authentication too: the grant a fresh token can rely on is the
 *    one just created through the Picker, so re-picking is what makes re-auth mean anything.
 *    Whether the pick is the same sheet the source already syncs is the caller's business —
 *    the edit dialog warns on a mismatch (see SourceForm).
 *
 * 2. `pickSpreadsheetForRef` — picker config -> pick, on a ref the caller already holds. For
 *    changing the chosen sheet before anything is saved, with no second consent.
 */

import { getSourceOAuthConsent, getSourceOAuthPickerConfig } from '@/hooks/api/useSources';
import {
  savedLinkPointsAt,
  spreadsheetIdFromSavedValue,
} from '@/components/ingest/sources/custom/utils';
import { openOAuthPopup } from './oauth-popup';
import {
  pickSpreadsheet,
  fetchSpreadsheetName,
  PickerCancelledError,
  type GooglePickerConfig,
  type PickedSpreadsheet,
} from './google-picker';

export interface GoogleConnectResult {
  /** opaque handle to the refresh_token stashed server-side; redeemed on save */
  ref: string;
  /** the sheet the user granted us — write its `url` into the connector's spreadsheet_id */
  spreadsheet: PickedSpreadsheet;
  /** Title of the sheet named in `previousSheet`, when the pick was a DIFFERENT file and Drive
   *  would tell us. Absent otherwise — a warning that cannot name the old sheet says less, but
   *  the connect itself never depends on it. */
  previousSheetName?: string;
}

export interface GoogleConnectOptions {
  /** The `spreadsheet_id` this source syncs today (link or bare id). Given it, the flow resolves
   *  that sheet's title so a mismatch can be described in names rather than URLs. */
  previousSheet?: string;
}

/**
 * Run the whole flow for a spreadsheet source. `sourceDefName` is the source-definition
 * NAME (e.g. "Google Sheets") — the backend's OAuth registry key, checked against the ref.
 */
export async function connectGoogleSpreadsheet(
  sourceDefId: string,
  sourceDefName: string,
  options: GoogleConnectOptions = {}
): Promise<GoogleConnectResult> {
  const { authUrl } = await getSourceOAuthConsent(sourceDefId, sourceDefName);
  const { ref } = await openOAuthPopup(authUrl);

  // The access token is fetched per flow rather than kept around: it only exists so the
  // Picker can run, and the backend hands it out only to the orguser that owns the ref.
  const pickerConfig = await getSourceOAuthPickerConfig(sourceDefName, ref);

  let spreadsheet: PickedSpreadsheet;
  try {
    spreadsheet = await pickSpreadsheet(pickerConfig);
  } catch (error) {
    if (error instanceof PickerCancelledError) {
      // Authorized, but nothing granted — a source saved now could not read anything, so
      // this is a failed connect and the caller drops the ref.
      throw new Error('No spreadsheet selected — choose one to finish connecting Google');
    }
    throw error;
  }

  return {
    ref,
    spreadsheet,
    previousSheetName: await previousName(pickerConfig, spreadsheet, options),
  };
}

/**
 * Title of the sheet the source syncs today — only when the pick moved it somewhere else, since
 * that is the only case a warning has to describe. Inside this module because the access token
 * is: it exists here for the length of one flow and goes no further.
 *
 * Never throws. A name is a nicety on top of a connect that has already succeeded, so a revoked
 * grant, a deleted file or an unparsable saved link all mean "no name", not a failed connect.
 */
async function previousName(
  pickerConfig: GooglePickerConfig,
  picked: PickedSpreadsheet,
  { previousSheet }: GoogleConnectOptions
): Promise<string | undefined> {
  if (!previousSheet?.trim()) return undefined;
  if (savedLinkPointsAt(previousSheet, picked.id)) return undefined;

  const previousId = spreadsheetIdFromSavedValue(previousSheet);
  if (!previousId) return undefined;

  try {
    return await fetchSpreadsheetName(pickerConfig, previousId);
  } catch {
    return undefined;
  }
}

/**
 * Reopen the Picker against a ref the caller already holds, changing which spreadsheet is
 * granted without a second trip through consent. Backs "Choose a different sheet".
 *
 * Safe to call repeatedly: the backend reads the ref rather than consuming it (see
 * `redeem_refresh_token_ref`), so one consent can back several picks. `PickerCancelledError`
 * is passed through rather than rewrapped — the sheet already chosen stays, so a cancel here
 * is a no-op, not a failed connect.
 *
 * Throws the backend's "invalid or expired oauth session" once the ref's TTL is up; callers
 * fall back to `connectGoogleSpreadsheet`.
 */
export async function pickSpreadsheetForRef(
  sourceDefName: string,
  ref: string
): Promise<PickedSpreadsheet> {
  const pickerConfig = await getSourceOAuthPickerConfig(sourceDefName, ref);
  return pickSpreadsheet(pickerConfig);
}
