/**
 * One Google connect flow, shared by every host that offers "Sign in with Google" for a
 * spreadsheet source (the add-source wizard, the legacy source form, and re-authenticate in
 * the edit dialog).
 *
 * consent -> popup(ref) -> picker config -> pick a spreadsheet
 *
 * The last step is not optional. Dalgo asks Google for `drive.file`, which grants only the
 * files the user selects in the Picker, so a flow that ends without a pick leaves us
 * authorized to read nothing. Callers therefore get either a ref AND a spreadsheet, or an
 * error — never a ref on its own.
 */

import { getSourceOAuthConsent, getSourceOAuthPickerConfig } from '@/hooks/api/useSources';
import { openOAuthPopup } from './oauth-popup';
import { pickSpreadsheet, PickerCancelledError, type PickedSpreadsheet } from './google-picker';

export interface GoogleConnectResult {
  /** opaque handle to the refresh_token stashed server-side; redeemed on save */
  ref: string;
  /** the sheet the user granted us — write its `url` into the connector's spreadsheet_id */
  spreadsheet: PickedSpreadsheet;
}

/**
 * Run the whole flow for a spreadsheet source. `sourceDefName` is the source-definition
 * NAME (e.g. "Google Sheets") — the backend's OAuth registry key, checked against the ref.
 */
export async function connectGoogleSpreadsheet(
  sourceDefId: string,
  sourceDefName: string
): Promise<GoogleConnectResult> {
  const { authUrl } = await getSourceOAuthConsent(sourceDefId, sourceDefName);
  const { ref } = await openOAuthPopup(authUrl);

  // The access token is fetched per flow rather than kept around: it only exists so the
  // Picker can run, and the backend hands it out only to the orguser that owns the ref.
  const pickerConfig = await getSourceOAuthPickerConfig(sourceDefName, ref);

  try {
    const spreadsheet = await pickSpreadsheet(pickerConfig);
    return { ref, spreadsheet };
  } catch (error) {
    if (error instanceof PickerCancelledError) {
      // Authorized, but nothing granted — a source saved now could not read anything, so
      // this is a failed connect and the caller drops the ref.
      throw new Error('No spreadsheet selected — choose one to finish connecting Google');
    }
    throw error;
  }
}
