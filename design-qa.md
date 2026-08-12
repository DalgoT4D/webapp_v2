# DALGO-1625 two-pane table settings — design QA

- Source visual truth: `/Users/pratiksharao/.codex/generated_images/019ff004-8119-7f12-8173-4c4c9197af53/exec-dc932e27-db3a-44c5-bc8c-218ba123f448.png`
- Browser-rendered implementation: `/private/tmp/dalgo-inspector-implementation.png`
- Full-view comparison: `/private/tmp/dalgo-inspector-comparison.png`
- Focused panel comparison: `/private/tmp/dalgo-inspector-focused-comparison.png`
- Route: `http://localhost:3001/ingest`
- State: Edit `Audit Kobo Sync` → open `survey_responses` settings → expand Columns
- Browser viewport / CSS size: 1676 × 927 at device scale 1
- Source pixels: 1686 × 933
- Implementation pixels: 1676 × 927
- Normalization: the source was scaled to 1676 × 927 before the full-view comparison. The focused comparison crops the advanced-settings regions and normalizes their widths.

## Findings

No actionable P0, P1, or P2 visual differences remain.

- Typography: Dalgo's existing font, weights, compact labels, and heading hierarchy are preserved. The implementation is slightly denser than the concept image, which is acceptable because it follows the production design system and leaves more usable space for long schemas.
- Spacing and layout: the approved left-table/right-inspector composition is present; the settings panel remains bounded; controls, descriptions, and columns align in consistent rows; the inspector scrolls independently.
- Colors and tokens: implementation uses existing Dalgo foreground, border, muted, and primary tokens. The selected row and switches retain native Dalgo states rather than introducing mock-specific colors.
- Image quality: no raster or decorative image assets are part of this UI. Existing Lucide icons and native controls remain sharp.
- Copy: labels match table concepts, Sync appears only on the left, each right-side setting has one plain-language explanation, and Columns expands downward to show Include, Column, and Type.
- Accessibility and interaction: the inspector close control, active settings row, Columns expanded state, Sync switches, and form controls have spoken names. Opening/closing the panel and expanding Columns were exercised in the browser.
- Console: no browser console errors were present in the verified state.

## Google Sheets cast verification

The local visible fixture is KoboToolbox, so it correctly does not render a Cast to column. Google Sheets-specific rendering and selection were verified through focused component/integration tests: the form passes `showCastColumn=true` only for Google Sheets, the expanded Columns table renders Cast to, selecting Integer calls the existing cast updater, and save preserves the existing `post_sync_transform` payload.

## Comparison history

Pass 1 found no P0/P1/P2 mismatch. No visual fixes were required after the normalized full-view and focused-region comparisons.

## Primary interactions tested

1. Open Edit for the existing Kobo connection.
2. Open `survey_responses` Advanced settings.
3. Confirm Sync remains only in the left table.
4. Expand Columns downward.
5. Confirm Include, Column, and Type rows render inside the scrollable inspector.
6. Confirm the panel stays inside the modal at 1676 × 927.

## Follow-up polish

- P3: the mock uses square checkboxes for column inclusion while Dalgo's existing implementation uses switches. Keeping the native switch is deliberate for consistency.
- P3: the local fixture contains one table and five columns, whereas the mock shows two tables and 42 columns. This changes content density but not the implemented layout or behavior.

final result: passed
