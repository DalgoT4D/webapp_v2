import { TriangleAlert } from 'lucide-react';

interface GsheetsSheetWarningProps {
  /** A full sentence or more; the link to the current sheet follows it on its own. */
  message: string;
  /** The sheet this source syncs today. Linked only when it is a URL — the field also accepts a
   *  bare spreadsheet id, which would make a dead relative href. */
  currentSheetUrl?: string | null;
  testId: string;
  linkTestId: string;
}

/**
 * The amber "this is not the sheet this source syncs" note. Shared by both auth routes so a
 * repoint reads the same whether the sheet came from the Picker or was typed. Same amber panel
 * the chart builder uses for "this needs your attention before you save" (see DatasetSelector,
 * TableDimensionsSelector), so the two read as one system.
 */
export function GsheetsSheetWarning({
  message,
  currentSheetUrl,
  testId,
  linkTestId,
}: GsheetsSheetWarningProps) {
  const linkable = !!currentSheetUrl && /^https?:\/\//.test(currentSheetUrl);

  return (
    <div
      className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
      data-testid={testId}
    >
      <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
      <p className="min-w-0">
        {message}
        {linkable && (
          <>
            {' '}
            <a
              href={currentSheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={linkTestId}
              className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
            >
              Open the current sheet
            </a>
          </>
        )}
      </p>
    </div>
  );
}
