'use client';

import { Check, Loader2, TriangleAlert } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import type { CustomSourceOAuth } from './types';

interface GsheetsOAuthCardProps {
  oauth: CustomSourceOAuth;
  disabled?: boolean;
  /** The sheet this source reads, already rendered as a link or a quoted name. Null when there
   *  is none to show — a source with no grant yet, or a saved value that is a bare id. */
  sheetLink: React.ReactNode;
  /** Whether `sheetLink` shows the sheet's actual title. False when it is the generic "View
   *  sheet" link, which reads as its own offer and takes no introducing label. */
  sheetIsNamed?: boolean;
  /** The sheet this source reads today, linked from the note below so the user can find that
   *  same file in the Picker. Null when there is nothing to pick back. */
  linkToRepick: string | null;
}

/**
 * The contents of the "Sign in with Google" card: the button, the sheet it is bound to, and a
 * single note underneath.
 *
 * One note, never two. Every consent ends in the Picker, so the sheet can always change — before
 * a source exists that is free ("Choose a different sheet"), and afterwards it is a warned-about
 * change, since this source's connections are built on its current sheet's tabs. The warning
 * replaces the hint rather than stacking under it, and only one of the two carries a link to the
 * current sheet, so the card never shows two links to the same file.
 */
export function GsheetsOAuthCard({
  oauth,
  disabled,
  sheetLink,
  sheetIsNamed,
  linkToRepick,
}: GsheetsOAuthCardProps) {
  const {
    connected,
    lockWhenConnected,
    authedThisSession,
    picksSheet,
    buttonLabel,
    busy,
    onClick,
    onReplaceSheet,
    sheetWarning,
  } = oauth;

  // A sheet chosen in this session is "Selected" — it is not synced until the form is saved,
  // and on an existing source the old sheet is still the live one until then. Only a sheet that
  // arrived with the source can be called "Syncing".
  const sheetRowLabel = authedThisSession ? 'Selected' : 'Syncing';

  // The note's own link to the current sheet. Label differs by note: the hint's sentence has
  // already said which sheet it means, while the warning sits next to a DIFFERENT sheet's name
  // and has to say which one it is offering.
  const currentSheetLink = (label: string) =>
    linkToRepick && (
      <a
        href={linkToRepick}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="gsheets-repick-link"
        className="font-medium underline decoration-dotted underline-offset-2 hover:decoration-solid"
      >
        {label}
      </a>
    );

  return (
    <div className="space-y-3">
      {/* Two rows, the same pair in both hosts: WHO Dalgo is signed in as, then WHICH sheet it
          reads. Mixing them put three controls in one line and left the wizard and the edit
          dialog looking like different features. */}
      <div className="flex items-center gap-3" data-testid="gsheets-auth-row">
        {connected && lockWhenConnected ? (
          <span
            data-testid="gsheets-oauth-connected"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-md border border-green-600/40 bg-green-600/5 px-3 py-1.5 text-sm font-medium text-green-600 dark:border-green-400/40 dark:text-green-400"
          >
            <Check className="h-4 w-4 flex-shrink-0" />
            {buttonLabel}
          </span>
        ) : (
          <button
            type="button"
            data-testid="gsheets-oauth-connect-btn"
            onClick={onClick}
            disabled={disabled || busy}
            className="inline-flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {/* The tick marks what the user just did, not what the source already was. */}
            {authedThisSession ? (
              <Check className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <GoogleIcon className="h-4 w-4 flex-shrink-0" />
            )}
            <span className={authedThisSession ? 'text-green-600 dark:text-green-400' : undefined}>
              {buttonLabel}
            </span>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        )}
      </div>

      {(sheetLink || onReplaceSheet) && (
        <div className="flex items-center gap-3" data-testid="gsheets-sheet-row">
          {sheetLink && (
            <span
              data-testid="gsheets-picked-sheet"
              className="flex min-w-0 items-baseline gap-1.5 text-sm text-muted-foreground"
            >
              {sheetIsNamed && <span className="flex-shrink-0">{sheetRowLabel}</span>}
              {sheetLink}
            </span>
          )}

          {/* Shares `busy` with the sign-in button, so the two Google actions can never run at
              once — and on a host with no ref yet this one opens consent first (see the host). */}
          {onReplaceSheet && (
            <button
              type="button"
              data-testid="gsheets-replace-sheet-btn"
              onClick={onReplaceSheet}
              disabled={disabled || busy}
              className="inline-flex flex-shrink-0 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Choose another sheet
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            </button>
          )}
        </div>
      )}

      {sheetWarning ? (
        // Same amber panel the chart builder uses for "this needs your attention before you
        // save" (see DatasetSelector, TableDimensionsSelector), so the two read as one system.
        <div
          className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
          data-testid="gsheets-sheet-mismatch"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p className="min-w-0">
            {/* `sheetWarning` ends without punctuation so the link can close the sentence. */}
            {sheetWarning}
            {linkToRepick ? <> ({currentSheetLink('open the sheet it syncs today')}).</> : '.'}
          </p>
        </div>
      ) : (
        picksSheet &&
        linkToRepick && (
          <p className="text-xs text-muted-foreground" data-testid="gsheets-repick-hint">
            Google will ask you to choose the sheet again — pick the one this source already syncs
            {/* Exactly one link to that sheet per state. The row above carries it whenever it
                has one; a service-account source has no OAuth sheet to show up there, so on
                that route the link belongs here or nowhere. */}
            {!sheetLink && <> ({currentSheetLink('open it')})</>}.
          </p>
        )
      )}
    </div>
  );
}
