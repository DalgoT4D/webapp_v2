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
  /** Whether clicking opens Google's Picker. False when re-authenticating a source that is
   *  already OAuth-connected: it keeps the sheet it holds a grant for, and offering a file
   *  chooser there is how a source silently ends up aimed somewhere else. */
  picksSheet: boolean;
  onClick: () => void;
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
  /** Google Sheets only. The host can't infer this from the config: the managed option leaves
   *  credentials empty on purpose, so empty means "backend fills it in", not "nothing chosen". */
  onAuthSatisfiedChange?: (satisfied: boolean) => void;
}

// Per-source config for the friendly connection view. Drives stream relabeling
// and which sync options are offered (e.g. Google Sheets is full-refresh only).
export interface ConnectionViewConfig {
  streamNoun: string; // column label for a stream — always "Tables"
  supportsIncremental: boolean; // false hides the incremental column entirely
  allowedDestModes: DestinationSyncMode[]; // which write modes the dropdown offers
}
