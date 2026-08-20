'use client';

import { useEffect, useRef, useState } from 'react';
import type { FieldValues, UseFormSetValue } from 'react-hook-form';

interface UseGsheetsOAuthLinkArgs {
  mode: 'create' | 'edit';
  /** The host's read of "this source is on the Google route" — true from mount for a source
   *  saved that way, and flipped mid-session the moment a ref is acquired. */
  connected: boolean;
  usingOAuth: boolean;
  /** URL of a sheet picked this session, if any. */
  pickedUrl?: string;
  /** Current value of the connector's `spreadsheet_id` field. */
  savedLink?: string;
  spreadsheetPath: string;
  hasSpreadsheetField: boolean;
  setValue: UseFormSetValue<FieldValues>;
}

interface UseGsheetsOAuthLinkResult {
  /** The sheet that belongs to the Google route, if there is one. */
  oauthLink?: string;
  /** Whether this source arrived already on the Google route. */
  openedOnOAuth: boolean;
}

/**
 * Which spreadsheet link belongs to the Google route, and keeping it off the other one.
 *
 * Google's `drive.file` grant covers only files handed over through the Picker, so a link the
 * Google route owns is unreadable by a service-account key. Left sitting in the service card's
 * input it reads as "already filled in" for a sheet that key cannot open — hence the clear on
 * the way out, and the restore on the way back so the Google route still submits its sheet.
 */
export function useGsheetsOAuthLink({
  mode,
  connected,
  usingOAuth,
  pickedUrl,
  savedLink,
  spreadsheetPath,
  hasSpreadsheetField,
  setValue,
}: UseGsheetsOAuthLinkArgs): UseGsheetsOAuthLinkResult {
  // Read once: `connected` flips when a ref is acquired this session, and reading it later
  // would reclassify a service-account source's typed link as OAuth-granted.
  const [openedOnOAuth] = useState(() => mode === 'edit' && connected);

  // Latched as it appears rather than read at mount: the edit host populates the form with
  // `reset()` in an effect, a commit after this form mounts. Latching is safe only while the
  // Google route is selected — that route renders no link input, so whatever the field holds
  // came from the saved config, never from typing.
  const savedOAuthLink = useRef<string | undefined>(undefined);
  if (openedOnOAuth && usingOAuth && !pickedUrl && savedLink) {
    savedOAuthLink.current = savedLink;
  }

  const oauthLink = pickedUrl ?? savedOAuthLink.current;

  useEffect(() => {
    if (!hasSpreadsheetField || !oauthLink) return;
    if (usingOAuth) {
      if (savedLink !== oauthLink) setValue(spreadsheetPath, oauthLink, { shouldValidate: true });
      return;
    }
    if (savedLink === oauthLink) setValue(spreadsheetPath, '', { shouldValidate: true });
  }, [usingOAuth, oauthLink, savedLink, spreadsheetPath, hasSpreadsheetField, setValue]);

  return { oauthLink, openedOnOAuth };
}
