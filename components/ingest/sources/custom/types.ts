import type { Control, FieldValues, UseFormSetValue } from 'react-hook-form';
import type { ParsedSpec } from '@/components/connectors/types';
import type { DestinationSyncMode } from '@/constants/connections';

/** Google-only OAuth wiring passed from the parent (create wizard or edit modal). */
export interface CustomSourceOAuth {
  /** Ref acquired (create) or the source is already OAuth-connected (edit). */
  connected: boolean;
  busy: boolean;
  buttonLabel: string;
  /** Create: render a static confirmation once connected. Edit: keep re-auth clickable. */
  lockWhenConnected: boolean;
  /** The user completed a Google sign-in in THIS session. Drives the tick on the button —
   *  `connected` can't, since an already-OAuth source arrives connected and would show a tick
   *  over an action the user has not taken yet. */
  authedThisSession?: boolean;
  /** Whether clicking opens Google's Picker. True everywhere Google sign-in is offered: the
   *  `drive.file` grant a token can act on is the one created by picking, so a consent that
   *  ends without a pick authorizes nothing. Drives the "find this same sheet" hint. */
  picksSheet: boolean;
  onClick: () => void;
  /** Reopen the Picker on the ref already held, swapping the chosen sheet with no second
   *  consent. Supplied only where a swap is harmless — creating a source, before it exists.
   *  Omitted on edit: the sheet is changed there by re-authenticating, which warns. */
  onReplaceSheet?: () => void;
  /** Amber warning shown under the card: the sheet just picked is not the one this source
   *  syncs today. A warning rather than a rejection — the user may mean it — but its
   *  connections' catalogs describe the old sheet's tabs, so it has to be said. */
  sheetWarning?: string;
  /** Link to the sheet this source syncs TODAY, so the user can find that same file in the
   *  Picker. The host owns it because only the host still knows: the form's spreadsheet field
   *  is overwritten by each pick. Absent when there is nothing to pick back — a source being
   *  created syncs nothing yet. */
  linkToRepick?: string;
  /** Inline validation error shown under the Authentication section (e.g. neither
   *  Google sign-in nor a service-account JSON was provided). */
  error?: string;
  /** The sheet the Picker just returned, shown as a clickable confirmation — the form holds only
   *  the link, which is unreadable on its own. Absent for a source connected in an earlier
   *  session (Airbyte stores no title); the form then links the saved value under a generic label. */
  connectedSheet?: { name: string; url: string };
}

/**
 * Contract every custom source form implements. Presentation only — the parent
 * owns the source-name input, footer buttons, and submit/OAuth orchestration.
 */
export interface CustomSourceFormProps {
  parsedSpec: ParsedSpec;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
  mode: 'create' | 'edit';
  /** Supplied only for Google Sheets; other forms ignore it. */
  oauth?: CustomSourceOAuth;
  /** Google Sheets only. The host can't infer this from the config: on the Google route the
   *  credentials are built server-side from the OAuth ref, so an empty credentials block means
   *  "the backend fills it in", not "nothing chosen". */
  onAuthSatisfiedChange?: (satisfied: boolean) => void;
}

// Per-source config for the friendly connection view. Drives stream relabeling
// and which sync options are offered (e.g. Google Sheets is full-refresh only).
export interface ConnectionViewConfig {
  streamNoun: string; // column label for a stream — always "Tables"
  supportsIncremental: boolean; // false hides the incremental column entirely
  allowedDestModes: DestinationSyncMode[]; // which write modes the dropdown offers
}
