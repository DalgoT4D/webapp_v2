'use client';

import { Loader2 } from 'lucide-react';
import type { Control, FieldValues, UseFormSetValue } from 'react-hook-form';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import { SourceHelperPanel } from '@/components/ingest/sources/wizard/SourceHelperPanel';
import type { ParsedSpec } from '@/components/connectors/types';
import type { CustomSource } from '@/components/ingest/sources/custom/registry';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';

interface SourceConfigFieldsProps {
  parsedSpec: ParsedSpec | null;
  specLoading: boolean;
  /** Non-null when the source has a hand-tailored form + docs panel. */
  custom: CustomSource | null;
  /** Source-definition display name — labels the docs panel. */
  sourceName: string;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled: boolean;
  mode: 'create' | 'edit';
  /** Google-only OAuth wiring; forwarded to the custom form. Undefined otherwise. */
  oauth?: CustomSourceOAuth;
  /** Connection-test error logs from a failed check. */
  setupLogs: string[];
  /** Host-specific testid for the logs block ('wizard-setup-logs' | 'connection-logs'). */
  logsTestId: string;
}

/**
 * The shared "configure a source" body: a spec-loading indicator, then either the
 * custom (Google Sheets / KoboToolbox) form beside its docs panel OR the generic
 * spec-driven form, followed by connection-test error logs.
 *
 * Rendered by both the add-source wizard's create step and the edit-source dialog.
 * The source-name field, source-type picker, footer buttons, and save/OAuth
 * orchestration deliberately stay with each host — they genuinely diverge (fixed
 * source vs combobox picker; two-phase vs one-shot Google OAuth).
 */
export function SourceConfigFields({
  parsedSpec,
  specLoading,
  custom,
  sourceName,
  control,
  setValue,
  disabled,
  mode,
  oauth,
  setupLogs,
  logsTestId,
}: SourceConfigFieldsProps) {
  return (
    <>
      {specLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading configuration...
        </div>
      )}

      {/* Custom sources (Google Sheets, KoboToolbox) render a tailored form plus a
          docs panel; every other source keeps the generic spec-driven form. */}
      {!specLoading && parsedSpec && custom ? (
        <div className="grid grid-cols-[55fr_45fr] gap-6">
          <div className="space-y-5">
            <custom.Form
              parsedSpec={parsedSpec}
              control={control}
              setValue={setValue}
              disabled={disabled}
              mode={mode}
              oauth={oauth}
            />
          </div>
          <SourceHelperPanel sourceName={sourceName} />
        </div>
      ) : !specLoading && parsedSpec ? (
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
