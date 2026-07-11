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
  onClick: () => void;
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
}

// Per-source config for the friendly connection view. Drives stream relabeling
// and which sync options are offered (e.g. Google Sheets is full-refresh only).
export interface ConnectionViewConfig {
  streamNoun: string; // column label for a stream, e.g. "Tabs", "Forms"
  supportsIncremental: boolean; // false hides the incremental column entirely
  allowedDestModes: DestinationSyncMode[]; // which write modes the dropdown offers
}
