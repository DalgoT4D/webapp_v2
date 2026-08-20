/**
 * The Google connect flows, shared by every host that offers "Sign in with Google" for a
 * spreadsheet source (the add-source wizard, the legacy source form, and re-authenticate in
 * the edit dialog).
 *
 * Two flows, because there are two things a user can mean:
 *
 * 1. `connectGoogleSpreadsheet` — consent -> popup(ref) -> picker config -> pick a spreadsheet.
 *    For a source that holds no grant yet. The pick is not optional: Dalgo asks Google for
 *    `drive.file`, which grants only the files the user selects in the Picker, so a flow that
 *    ends without one leaves us authorized to read nothing. Callers get either a ref AND a
 *    spreadsheet, or an error — never a ref on its own.
 *
 * 2. `reconnectGoogle` — consent -> popup(ref), and stop. For a source ALREADY connected this
 *    way. Google records the `drive.file` grant against (oauth client, user, file), not against
 *    a token, so a fresh consent by the same user still reads the sheet that source already
 *    holds — no re-pick needed, and none wanted: re-picking is how a source silently ends up
 *    aimed at a different spreadsheet. Changing the sheet is adding a new source.
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

/**
 * Refresh Google access for a source that is already connected this way, leaving its
 * spreadsheet untouched. No Picker: see the flow note at the top of this file.
 *
 * One case this cannot recover: if the user removed Dalgo from their Google account, that
 * revoked the per-file grants too, and the new token reads nothing. Airbyte's check on save is
 * what catches it — the source then has to be added again.
 */
export async function reconnectGoogle(
  sourceDefId: string,
  sourceDefName: string
): Promise<{ ref: string }> {
  const { authUrl } = await getSourceOAuthConsent(sourceDefId, sourceDefName);
  return openOAuthPopup(authUrl);
}
