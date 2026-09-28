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
}

/**
 * Which spreadsheet link belongs to the Google route, and what the service card starts with.
 *
 * Creating a source: the Picker's sheet is cleared on the way to the service card. Nothing syncs
 * yet, and `drive.file` granted that file to the OAuth token, not to a key, so pre-filling it
 * would read as "already set up" for a sheet the key cannot open.
 *
 * Editing: the link stays. Moving an existing source to a key is about swapping credentials,
 * not sheets — its connections are built on that sheet's tabs — so the user only has to share it
 * with the key's address and paste the key. A different link is warned about by the form.
 *
 * Either way, going back to the Google route restores its sheet so that route submits it.
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
    if (mode === 'create' && savedLink === oauthLink) {
      setValue(spreadsheetPath, '', { shouldValidate: true });
    }
  }, [mode, usingOAuth, oauthLink, savedLink, spreadsheetPath, hasSpreadsheetField, setValue]);

  return { oauthLink };
}
