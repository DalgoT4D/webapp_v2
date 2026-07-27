'use client';

import type { ReactNode } from 'react';
import type { Control, FieldValues, UseFormSetValue } from 'react-hook-form';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import type { ParsedSpec } from '@/components/connectors/types';
import type { CustomSource } from '@/components/ingest/sources/custom/registry';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';

interface SourceConfigFieldsProps {
  parsedSpec: ParsedSpec | null;
  /** Non-null when the source has a hand-tailored form. */
  custom: CustomSource | null;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled: boolean;
  mode: 'create' | 'edit';
  /** Google-only OAuth wiring; forwarded to the custom form. Undefined otherwise. */
  oauth?: CustomSourceOAuth;
  /** Host-owned source-name field, rendered at the top of the custom form's left
   *  column so it lines up with the other fields (not full-width above the grid). */
  nameField?: ReactNode;
  /** Connection-test error logs from a failed check. */
  setupLogs: string[];
  /** Host-specific testid for the logs block ('wizard-setup-logs' | 'connection-logs'). */
  logsTestId: string;
}

/**
 * The shared "configure a source" body: either the custom (Google Sheets /
 * KoboToolbox) form OR the generic spec-driven form, followed by connection-test
 * error logs.
 *
 * Rendered by both the add-source wizard's create step and the edit-source dialog.
 * Both hosts hold their own full-panel loader until the spec resolves, so this
 * component is only ever rendered with a spec in hand. The source-name field,
 * footer buttons, and save/OAuth orchestration stay with each host — they
 * genuinely diverge (fixed source vs locked type; two-phase vs one-shot OAuth).
 */
export function SourceConfigFields({
  parsedSpec,
  custom,
  control,
  setValue,
  disabled,
  mode,
  oauth,
  nameField,
  setupLogs,
  logsTestId,
}: SourceConfigFieldsProps) {
  return (
    <>
      {/* Custom sources (Google Sheets, KoboToolbox) render a tailored form; every
          other source keeps the generic spec-driven form. */}
      {parsedSpec && custom ? (
        <div className="space-y-5">
          {nameField}
          <custom.Form
            parsedSpec={parsedSpec}
            control={control}
            setValue={setValue}
            disabled={disabled}
            mode={mode}
            oauth={oauth}
          />
        </div>
      ) : parsedSpec ? (
        <ConnectorConfigForm
          parsedSpec={parsedSpec}
          control={control}
          setValue={setValue}
          disabled={disabled}
        />
      ) : null}

      {setupLogs.length > 0 && (
        <div
          className="rounded-md bg-red-50 dark:bg-red-950 p-3 text-sm text-red-700 dark:text-red-300"
          data-testid={logsTestId}
        >
          <pre className="whitespace-pre-wrap font-mono text-xs max-h-48 overflow-y-auto">
            {setupLogs.join('\n')}
          </pre>
        </div>
      )}
    </>
  );
}
