'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConnectorConfigForm } from '@/components/connectors/ConnectorConfigForm';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues, extractSpecDefaults } from '@/components/connectors/utils';
import type { FieldNode, ParsedSpec } from '@/components/connectors/types';
import { useSourceSpec, GOOGLE_SHEETS_SOURCE_DEFINITION_ID } from '@/hooks/api/useSources';
import { useSourceSave } from '@/hooks/useSourceSave';
import type { SourceDefinition } from '@/types/source';
import { SourceHelperPanel } from './SourceHelperPanel';

interface Props {
  def: SourceDefinition;
  onCreated: (sourceId: string) => void;
  onBack: () => void;
}

export function CreateSourceStep({ def, onCreated, onBack }: Props) {
  const isGoogleSheets = def.sourceDefinitionId === GOOGLE_SHEETS_SOURCE_DEFINITION_ID;
  const { data: spec, isLoading: specLoading } = useSourceSpec(def.sourceDefinitionId);
  const [name, setName] = useState('');
  const { control, setValue, getValues, reset } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

  const parsedSpec = useMemo<ParsedSpec | null>(
    () => (spec ? parseAirbyteSpec(spec) : null),
    [spec]
  );

  // The auth block is the oneOf whose discriminator is `auth_type`. For Google Sheets
  // the "Sign in with Google" button replaces it entirely — the raw credential fields
  // (client id/secret/refresh token, service account, etc.) must never render here.
  const authField = useMemo<FieldNode | null>(
    () => parsedSpec?.fields.find((f) => f.type === 'oneOf' && f.constKey === 'auth_type') ?? null,
    [parsedSpec]
  );

  // Everything except the auth block, for Google Sheets only — matches SourceForm's
  // nonAuthSpec pattern. Non-Google sources render the full parsed spec unchanged.
  const nonAuthSpec = useMemo<ParsedSpec | null>(() => {
    if (!parsedSpec) return null;
    if (!isGoogleSheets || !authField) return parsedSpec;
    return { ...parsedSpec, fields: parsedSpec.fields.filter((f) => f !== authField) };
  }, [parsedSpec, isGoogleSheets, authField]);

  // Populate the form with the spec's defaults once per source definition. Guarded by
  // a ref (keyed on def.sourceDefinitionId) rather than depending on `parsedSpec`
  // directly — SWR-backed hooks return a referentially stable object in production,
  // but reacting to `parsedSpec` identity alone would re-fire (and loop, via
  // reset -> re-render -> new parsedSpec ref) if the underlying hook ever returns a
  // fresh object on every render, e.g. under simplified test mocks.
  const defaultsAppliedForDefId = useRef<string | null>(null);
  useEffect(() => {
    if (parsedSpec && defaultsAppliedForDefId.current !== def.sourceDefinitionId) {
      defaultsAppliedForDefId.current = def.sourceDefinitionId;
      reset(extractSpecDefaults(parsedSpec));
    }
  }, [parsedSpec, def.sourceDefinitionId, reset]);

  const getConfig = useCallback(() => {
    const formValues = getValues();
    const fieldsForClean = isGoogleSheets ? nonAuthSpec?.fields : parsedSpec?.fields;
    return fieldsForClean ? cleanFormValues(formValues, fieldsForClean) : formValues;
  }, [getValues, parsedSpec, nonAuthSpec, isGoogleSheets]);

  const { save, connectGoogle, loading, oauthConnecting, setupLogs } = useSourceSave({
    sourceDefId: def.sourceDefinitionId,
    getConfig,
    onSaved: onCreated,
  });

  return (
    <div className="grid grid-cols-[1fr_320px] gap-6" data-testid="create-source-step">
      <div className="space-y-5">
        <div>
          <label className="text-sm font-medium">
            Source name <span className="text-destructive">*</span>
          </label>
          <Input
            data-testid="wizard-source-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`${def.name} source`}
            className="mt-1.5"
            disabled={loading}
          />
        </div>

        {specLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading configuration…
          </div>
        )}

        {nonAuthSpec && !specLoading && (
          <ConnectorConfigForm
            parsedSpec={nonAuthSpec}
            control={control}
            setValue={setValue}
            disabled={loading}
          />
        )}

        {setupLogs.length > 0 && (
          <pre
            data-testid="wizard-setup-logs"
            className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-md bg-red-50 p-3 font-mono text-xs text-red-700 dark:bg-red-950 dark:text-red-300"
          >
            {setupLogs.join('\n')}
          </pre>
        )}
      </div>

      <SourceHelperPanel sourceName={def.name} />

      <div className="col-span-2 flex justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading || oauthConnecting}
        >
          Back
        </Button>
        {isGoogleSheets ? (
          <Button
            type="button"
            variant="primary"
            data-testid="gsheets-oauth-connect-btn"
            disabled={oauthConnecting || !name.trim()}
            onClick={() => connectGoogle(name)}
          >
            {oauthConnecting && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Sign in with Google
          </Button>
        ) : (
          <Button
            type="button"
            variant="primary"
            data-testid="wizard-next-btn"
            disabled={loading || !name.trim() || !parsedSpec}
            onClick={() => save(name)}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
