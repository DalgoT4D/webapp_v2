'use client';

import { Check, Loader2 } from 'lucide-react';
import { GoogleIcon } from './GoogleIcon';
import type { CustomSourceOAuth } from './types';

interface GsheetsOAuthCardProps {
  oauth: CustomSourceOAuth;
  disabled?: boolean;
  /** The sheet this source reads, already rendered as a link or a quoted name. Null when there
   *  is none to show — a source with no grant yet, or a saved value that is a bare id. */
  sheetLink: React.ReactNode;
  /** The sheet a service-account source reads today, shown so the user knows which file to find
   *  in the Picker. Null unless this route is about to ask for one. */
  linkToRepick: string | null;
}

/**
 * The contents of the "Sign in with Google" card: the button, the sheet it is bound to, and the
 * one sentence that stops the two from being confused.
 *
 * Both hints exist because "authenticate" is ambiguous about whether the sheet moves with it.
 * It never does silently — a source already on this route keeps its sheet, and one switching
 * over has to pick the same one back (the host rejects anything else). Changing the spreadsheet
 * means a new source, because this source's connections are built on its current sheet's tabs.
 */
export function GsheetsOAuthCard({
  oauth,
  disabled,
  sheetLink,
  linkToRepick,
}: GsheetsOAuthCardProps) {
  const { connected, lockWhenConnected, picksSheet, buttonLabel, busy, onClick } = oauth;

  return (
    <div className="space-y-2">
      {/* Button left, sheet right: the name is the answer to "which file?", so it reads as a
          value beside the control rather than as more button. */}
      <div className="flex items-center gap-3">
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
            {connected ? (
              <Check className="h-4 w-4 flex-shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <GoogleIcon className="h-4 w-4 flex-shrink-0" />
            )}
            <span className={connected ? 'text-green-600 dark:text-green-400' : undefined}>
              {buttonLabel}
            </span>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          </button>
        )}

        {sheetLink && (
          <span
            data-testid="gsheets-picked-sheet"
            className="ml-auto flex min-w-0 items-baseline gap-1.5 text-sm text-muted-foreground"
          >
            <span className="flex-shrink-0">Sheet added</span>
            {sheetLink}
          </span>
        )}
      </div>

      {!picksSheet && connected && !lockWhenConnected && (
        <p className="text-xs text-muted-foreground" data-testid="gsheets-reconnect-hint">
          Reconnecting refreshes Dalgo&apos;s access to this same sheet. To sync a different sheet,
          add it as a new source.
        </p>
      )}

      {picksSheet && linkToRepick && (
        <p className="text-xs text-muted-foreground" data-testid="gsheets-repick-hint">
          Google&apos;s window will ask you to choose a spreadsheet — pick the same one this source
          already syncs (
          <a
            href={linkToRepick}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="gsheets-repick-link"
            className="font-medium text-primary underline decoration-dotted underline-offset-2 hover:decoration-solid"
          >
            open it
          </a>
          ). To sync a different spreadsheet, add it as a new source instead.
        </p>
      )}
    </div>
  );
}
