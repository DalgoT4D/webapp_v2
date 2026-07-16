'use client';

import { useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { useSourceSpec } from '@/hooks/api/useSources';
import { parseAirbyteSpec } from '@/components/connectors/spec-parser';
import { cleanFormValues } from '@/components/connectors/utils';
import type { ParsedSpec } from '@/components/connectors/types';
import { getCustomSource } from '@/components/ingest/sources/custom/registry';
import { SOURCE_NAME_GOOGLE_SHEETS } from '@/components/ingest/sources/custom/constants';

interface UseSourceConfigFormArgs {
  /** Selected source-definition id — drives the spec fetch; null before a pick. */
  sourceDefId: string | null;
  /** Source-definition display name — resolves the custom (Sheets/Kobo) form. */
  sourceName: string;
}

/**
 * Shared "configure a source" plumbing: fetch + parse the connector spec, own the
 * react-hook-form instance, resolve whether this source has a custom form, and
 * build the cleaned config payload. Consumed by both the add-source wizard's
 * create step and the edit-source dialog, so the two render an identical form
 * body (see SourceConfigFields) while keeping their own save/OAuth/footer logic.
 *
 * The spec-defaults population differs per host (create seeds defaults; edit
 * fills from the existing source with discriminator inference), so each host runs
 * its own effect against the returned `reset`.
 */
export function useSourceConfigForm({ sourceDefId, sourceName }: UseSourceConfigFormArgs) {
  const { data: spec, isLoading: specLoading } = useSourceSpec(sourceDefId);

  const { control, setValue, getValues, reset, handleSubmit, trigger } = useForm({
    defaultValues: {} as Record<string, unknown>,
  });

  const parsedSpec = useMemo<ParsedSpec | null>(
    () => (spec ? parseAirbyteSpec(spec) : null),
    [spec]
  );

  const custom = getCustomSource(sourceName);
  const isGoogleSheetsCustom = sourceName === SOURCE_NAME_GOOGLE_SHEETS;

  // Cleaned form values to send on save/connect. Value-driven: keeps whatever the
  // form wrote (service-account creds, or the OAuth discriminator) while coercing
  // number fields. The Google OAuth path omits credentials — the backend injects
  // them server-side.
  const buildConfig = useCallback(() => {
    const values = getValues();
    return parsedSpec ? cleanFormValues(values, parsedSpec.fields) : values;
  }, [getValues, parsedSpec]);

  return {
    spec,
    specLoading,
    parsedSpec,
    control,
    setValue,
    getValues,
    reset,
    handleSubmit,
    trigger,
    buildConfig,
    custom,
    isGoogleSheetsCustom,
  };
}
