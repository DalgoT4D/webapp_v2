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
