import type { Control, FieldValues, UseFormSetValue } from 'react-hook-form';
import type { ParsedSpec } from '@/components/connectors/types';
import type { DestinationSyncMode } from '@/constants/connections';
import type { SourceAuthMode } from '@/constants/analytics';

/** Google-only OAuth wiring passed from the parent (create wizard or edit modal). */
export interface CustomSourceOAuth {
  /** Ref acquired (create) or the source is already OAuth-connected (edit). */
  connected: boolean;
  busy: boolean;
  buttonLabel: string;
  /** Create: render a static confirmation once connected. Edit: keep re-auth clickable. */
  lockWhenConnected: boolean;
  onClick: () => void;
  /** Inline validation error shown under the Authentication section (e.g. neither
   *  Google sign-in nor a service-account JSON was provided). */
  error?: string;
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
  /** Google Sheets only, analytics. Reports which auth route is currently selected so
   *  SOURCE_CREATED can say whether the user finished on Dalgo's managed key or their own.
   *  Same reason as onAuthSatisfiedChange: the config alone can't distinguish them. */
  onAuthModeChange?: (mode: SourceAuthMode) => void;
}

// Per-source config for the friendly connection view. Drives stream relabeling
// and which sync options are offered (e.g. Google Sheets is full-refresh only).
export interface ConnectionViewConfig {
  streamNoun: string; // column label for a stream — always "Tables"
  supportsIncremental: boolean; // false hides the incremental column entirely
  allowedDestModes: DestinationSyncMode[]; // which write modes the dropdown offers
}
