/** Helpers shared by the hand-tailored source forms. */

/**
 * Does a saved `spreadsheet_id` refer to the spreadsheet Google's Picker just returned?
 *
 * Deliberately NOT a URL parser. The connector's field accepts "either the full url to
 * spreadsheet or the spreadsheet id" and Airbyte resolves it with a shape-agnostic rule — the
 * first `/`-prefixed run of 20+ `[-\w]` characters, or the value as-is when it is not `https://`
 * (source-google-sheets `manifest.yaml`). Any regex we wrote here would be a guess at a format
 * Airbyte itself never assumes, and a wrong guess yields a wrong id, which reads as a mismatch
 * between a sheet and itself.
 *
 * So we search instead of parse. `pickedId` comes straight from the Picker, so it is exact, and
 * it is an opaque ~44-character base64url token — every URL that addresses that file contains it
 * verbatim (`/d/{id}`, `/u/0/d/{id}`, `open?id={id}`, `?key={id}`, or the bare id), and no other
 * sheet's link plausibly contains it. Nothing about the URL's shape has to be known or guessed.
 */
export function savedLinkPointsAt(
  savedValue: string | null | undefined,
  pickedId: string
): boolean {
  const saved = savedValue?.trim();
  if (!saved || !pickedId) return false;
  return saved.includes(pickedId);
}

/** Drive ids are 20+ of these; the length floor is what keeps `/spreadsheets/` and `/d/` out. */
const DRIVE_ID_SEGMENT = /\/([-\w]{20,})/;

/**
 * The spreadsheet id inside a saved `spreadsheet_id` value, or null when it cannot be read.
 *
 * Extraction is a last resort — `savedLinkPointsAt` exists precisely so comparisons never have
 * to parse — but an id is what Drive's API takes, so looking a sheet's NAME up needs one. This
 * applies Airbyte's own rule rather than a guess at link shapes (source-google-sheets
 * `manifest.yaml`): the first `/`-prefixed run of 20+ `[-\w]` characters, or the value as-is
 * when it is not an `http(s)` URL.
 *
 * Returning null is a normal outcome, not an error — a `?id=`-style link puts the id in the
 * query string, which the rule does not reach. Callers use the id for display only and simply
 * show less when there is none.
 */
export function spreadsheetIdFromSavedValue(savedValue: string | null | undefined): string | null {
  const saved = savedValue?.trim();
  if (!saved) return null;
  if (!/^https?:\/\//i.test(saved)) return saved;
  return DRIVE_ID_SEGMENT.exec(saved)?.[1] ?? null;
}
