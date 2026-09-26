'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FieldNode } from '@/components/connectors/types';
import type { CustomSourceOAuth } from '@/components/ingest/sources/custom/types';
import { SourceConfigFields } from '@/components/ingest/sources/SourceConfigFields';
import { cn } from '@/lib/utils';
import {
  useSourceDefinitions,
  useSource,
  updateSource,
  updateOAuthSource,
} from '@/hooks/api/useSources';
import {
  connectGoogleSpreadsheet,
  pickSpreadsheetForRef,
} from '@/components/connectors/google-oauth-connect';
import {
  PickerCancelledError,
  type PickedSpreadsheet,
} from '@/components/connectors/google-picker';
import {
  GSHEETS_AUTH_DISCRIMINATOR,
  GSHEETS_KEY_SPREADSHEET,
  GSHEETS_OAUTH_AUTH_TYPE,
  GSHEETS_OAUTH_BRANCH_KEYS,
} from '@/components/ingest/sources/custom/constants';
import { savedLinkPointsAt } from '@/components/ingest/sources/custom/utils';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { useSourceConfigForm } from '@/hooks/useSourceConfigForm';
import { trackEvent } from '@/lib/analytics';
import {
  ANALYTICS_EVENTS,
  GSHEETS_REPLACE_CONTEXTS,
  SOURCE_AUTH_MODES,
} from '@/constants/analytics';
import { toastSuccess, toastError, toastInfo } from '@/lib/toast';

/**
 * The amber note under the Google card when the chosen sheet is not the one the source syncs.
 *
 * Ends without punctuation: the card closes the sentence with a link to the current sheet. Two
 * wordings because the old sheet's title is best-effort — Airbyte stores only its link, so the
 * name comes from a Drive lookup during the sign-in that may not succeed.
 */
function mismatchWarning(mismatch: { picked: string; previous?: string } | null) {
  if (!mismatch) return undefined;
  const tail =
    'Its tables come from that sheet, so saving may break them — choose another sheet to pick it back, or save to switch this source over';
  return mismatch.previous
    ? `You selected “${mismatch.picked}”, but this source syncs “${mismatch.previous}”. ${tail}`
    : `You selected “${mismatch.picked}”, which is a different sheet from the one this source syncs today. ${tail}`;
}

// WebSocket endpoint for source connection check
const SOURCE_CHECK_WS_PATH = 'airbyte/source/check_connection';

// Airbyte connection check returns 'succeeded' on success
const AIRBYTE_CHECK_SUCCEEDED = 'succeeded';

interface SourceFormProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  /** Required: this dialog only edits an existing source. Creation goes through
   *  the add-source wizard (AddSourceWizard). */
  sourceId: string;
}

/**
 * Edit-source dialog. Creation lives entirely in the add-source wizard, so this
 * component has no create path — it always loads an existing source, locks the
 * source type, and updates.
 */
export function SourceForm({ open, onClose, onSuccess, sourceId }: SourceFormProps) {
  const { data: definitions } = useSourceDefinitions();
  // mutate() re-fetches this specific source (a separate SWR key from the list
  // useSources() revalidates on close) — without it, reopening this dialog right
  // after a save serves the stale pre-save response until some later revalidation
  // catches up, e.g. showing a just-removed service-account key one more time.
  const { data: source, mutate: mutateSource } = useSource(open ? sourceId : null);

  const [selectedDefId, setSelectedDefId] = useState<string | null>(null);

  // Google Sheets and KoboToolbox get a hand-tailored form; other sources
  // keep the generic spec-driven form. Resolved by the definition's name.
  const selectedDef = definitions.find((d) => d.sourceDefinitionId === selectedDefId);
  const selectedName = selectedDef?.name ?? '';

  // Shared spec + react-hook-form plumbing (also used by the add-source wizard).
  const {
    specLoading,
    parsedSpec,
    control,
    setValue,
    reset,
    handleSubmit,
    buildConfig,
    custom,
    isGoogleSheetsCustom,
  } = useSourceConfigForm({ sourceDefId: selectedDefId, sourceName: selectedName });

  const [loading, setLoading] = useState(false);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [sourceName, setSourceName] = useState('');

  // Google OAuth: the credentials never reach the browser. "Re-authenticate" only runs
  // consent + popup and stashes the redeemed ref here; the actual update happens when
  // the user clicks "Save Changes And Test".
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [oauthRef, setOauthRef] = useState<string | null>(null);

  // The form reports whether auth is satisfied: which route is selected is its own state, and
  // on the Google route the credentials are built server-side from the OAuth ref, so an empty
  // credentials block in the form is the expected state rather than a missing one. Declared here
  // because the Google handler below reports a rejected pick through the same inline error.
  const [authSatisfied, setAuthSatisfied] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  // The sheet the Picker just returned — display only (the form value is its URL). Null on a
  // source connected in an earlier session: Airbyte stores the link, not the title, so the form
  // links the saved link under a generic label until the user re-picks.
  const [pickedSheet, setPickedSheet] = useState<{ name: string; url: string } | null>(null);
  // Set when a pick is not the sheet this source syncs today: the two sheets' names, as far as
  // they are known. A warning rather than a block — repointing may be deliberate — but the
  // connections built on this source read the old sheet's tabs, so it cannot pass silently.
  // `previous` is absent when Drive would not name the old sheet (see connectGoogleSpreadsheet).
  const [sheetMismatch, setSheetMismatch] = useState<{
    picked: string;
    previous?: string;
  } | null>(null);
  // Title of the sheet this source syncs today, resolved from Drive during a sign-in. Kept once
  // resolved: the saved sheet cannot change while the dialog is open, and the swap button holds
  // no token of its own to look it up again.
  const [knownPreviousName, setPreviousSheetName] = useState<string | undefined>(undefined);
  // Inline required-field errors, surfaced on submit (same pattern as the
  // add-source wizard and the connection form: the button stays clickable and
  // pressing it reveals what's missing, rather than a silently disabled button).
  const [nameError, setNameError] = useState<string | null>(null);

  // An existing Google-Sheets source already authed via OAuth: its stored credentials
  // use the Client (OAuth) discriminator. Such a source is already connected — editing
  // it should NOT force a fresh login; re-auth is optional.
  const isConnected = useMemo(() => {
    if (!isGoogleSheetsCustom) return false;
    const creds = source?.connectionConfiguration?.credentials as
      | Record<string, unknown>
      | undefined;
    if (!creds) return false;

    const authType = creds[GSHEETS_AUTH_DISCRIMINATOR];
    if (typeof authType === 'string') return authType === GSHEETS_OAUTH_AUTH_TYPE;

    // Discriminator omitted — Airbyte does not always return const keys, which is why the form
    // has `inferDiscriminators`. Infer the same way here: a credentials block carrying an
    // OAuth-only field came from Google, whatever it does or doesn't say about auth_type.
    // Nothing recognisable (an empty block) stays "not connected", so the card offers a
    // sign-in rather than claiming access it cannot prove.
    return GSHEETS_OAUTH_BRANCH_KEYS.some((key) => !!creds[key]);
  }, [isGoogleSheetsCustom, source]);

  // The sheet this source syncs as saved, read from the loaded source rather than the form: the
  // form's value is overwritten by each pick, so only this survives as something to compare a
  // pick against.
  const savedSheetAtLoad = useMemo(() => {
    const saved = source?.connectionConfiguration?.[GSHEETS_KEY_SPREADSHEET];
    return typeof saved === 'string' ? saved : undefined;
  }, [source]);

  // The same sheet, but only when it can be opened: the connector's field accepts a bare
  // spreadsheet id too, and linking that would render a dead relative href.
  const sheetToRepick =
    (!pickedSheet || sheetMismatch) && /^https?:\/\//.test(savedSheetAtLoad ?? '')
      ? savedSheetAtLoad
      : undefined;

  // Load the source being edited
  useEffect(() => {
    if (open && source) {
      setSelectedDefId(source.sourceDefinitionId);
      setSourceName(source.name);
    }
  }, [open, source]);

  // Populate form values once spec + source are both ready
  useEffect(() => {
    if (parsedSpec && source?.connectionConfiguration) {
      const config = structuredClone(source.connectionConfiguration);

      // The API often omits const discriminator keys (e.g. auth_type, tunnel_method).
      // Recursively walk all fields and fill in missing discriminators.
      function inferDiscriminators(fields: FieldNode[], root: Record<string, unknown>) {
        for (const field of fields) {
          if (field.type === 'oneOf' && field.constKey && field.constOptions?.length) {
            // Navigate to (or create) the nested object at field.path
            let target: Record<string, unknown> = root;
            for (const segment of field.path) {
              if (!target[segment] || typeof target[segment] !== 'object') {
                target[segment] = {};
              }
              target = target[segment] as Record<string, unknown>;
            }

            if (target[field.constKey] === undefined) {
              // Infer which option is active from its sub-fields being present
              let inferred = false;
              for (const option of field.constOptions) {
                const subs = field.oneOfSubFields?.filter((sf) => sf.parentValue === option.value);
                if (subs?.some((sf) => target[sf.path[sf.path.length - 1]] !== undefined)) {
                  target[field.constKey] = option.value;
                  inferred = true;
                  break;
                }
              }
              if (!inferred) {
                target[field.constKey] = field.constOptions[0].value;
              }
            }

            // Recurse into oneOf sub-fields (they may contain nested oneOf)
            if (field.oneOfSubFields) {
              inferDiscriminators(field.oneOfSubFields, root);
            }
          }

          // Recurse into array items — each item is its own root for sub-fields
          if (field.type === 'array' && field.arraySubFields) {
            let arrayVal: unknown = root;
            for (const segment of field.path) {
              if (arrayVal && typeof arrayVal === 'object' && !Array.isArray(arrayVal)) {
                arrayVal = (arrayVal as Record<string, unknown>)[segment];
              } else {
                arrayVal = undefined;
                break;
              }
            }
            if (Array.isArray(arrayVal)) {
              for (const item of arrayVal) {
                if (typeof item === 'object' && item !== null) {
                  inferDiscriminators(field.arraySubFields, item as Record<string, unknown>);
                }
              }
            }
          }
        }
      }

      inferDiscriminators(parsedSpec.fields, config);
      reset(config);
    }
  }, [parsedSpec, source, reset]);

  // WebSocket for the connection check — connects once a submit sets `loading`.
  const { sendOrQueue, lastMessage } = useBackendWebSocket(SOURCE_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  // The Google button in the edit dialog. It only stashes the redeemed ref — the source is not
  // saved until the footer "Save Changes And Test", and the OAuth credentials never reach the
  // browser.
  //
  // One flow, and it always ends in the Picker. Under `drive.file` a token reads only the files
  // handed over through the Picker, so the pick is what the new access actually consists of:
  // that holds whether this source is already on the Google route or moving over from a
  // service-account key, whose link was typed and so carries no grant at all.
  //
  // Which sheet comes back is not enforced. This update keeps the source's id, so its
  // connections survive it, and their catalogs describe the tabs of the sheet it reads today —
  // a different pick leaves them on streams that may not exist. That can still be what the user
  // meant, so it is taken and warned about (`sheetMismatch`) rather than refused.
  // Write a pick into the form and judge it. Shared by the two ways a sheet arrives here —
  // signing in, and the sheet row's own swap button — so both warn on the same terms.
  const applyPick = useCallback(
    (spreadsheet: PickedSpreadsheet, previousName?: string) => {
      // Compared against the sheet the source was loaded with, never the live field: an earlier
      // pick this session may already have overwritten the field, and the warning has to keep
      // describing the sheet the source actually syncs until the update is saved.
      const repointed =
        !!savedSheetAtLoad?.trim() && !savedLinkPointsAt(savedSheetAtLoad, spreadsheet.id);

      setValue(GSHEETS_KEY_SPREADSHEET, spreadsheet.url, {
        shouldValidate: true,
        shouldDirty: true,
      });
      setPickedSheet({ name: spreadsheet.name, url: spreadsheet.url });
      setSheetMismatch(repointed ? { picked: spreadsheet.name, previous: previousName } : null);

      if (repointed) {
        trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_SHEET_REPLACED, {
          source_type: 'Google Sheets',
          context: GSHEETS_REPLACE_CONTEXTS.EDIT,
          mismatch: true,
        });
        // Neutral toast: the consequence is what the amber note under the card is for, and a
        // success tick over a repoint reads as approval of it.
        toastInfo.generic(`Selected “${spreadsheet.name}” — check the note below before saving`);
      } else {
        toastSuccess.generic(
          `Selected “${spreadsheet.name}” — click Save Changes And Test to apply`
        );
      }
      return repointed;
    },
    [savedSheetAtLoad, setValue]
  );

  const handleConnectGoogle = useCallback(async () => {
    if (!selectedDefId) return;
    // Same inline treatment as submit — a missing name is a form error, not a toast.
    if (!sourceName.trim()) {
      setNameError('Source name is required');
      return;
    }

    setOauthConnecting(true);
    try {
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_STARTED, { source_type: 'Google Sheets' });

      // The saved sheet rides along so the flow can name it with the token it already holds —
      // Airbyte stores the link and never the title, so a warning could not otherwise say which
      // sheet is being left behind. Kept for the swap button, which has no token of its own.
      const { ref, spreadsheet, previousSheetName } = await connectGoogleSpreadsheet(
        selectedDefId,
        selectedName,
        { previousSheet: savedSheetAtLoad }
      );

      setOauthRef(ref);
      if (previousSheetName) setPreviousSheetName(previousSheetName);
      trackEvent(ANALYTICS_EVENTS.SOURCE_OAUTH_CONNECTED, { source_type: 'Google Sheets' });
      applyPick(spreadsheet, previousSheetName ?? knownPreviousName);
    } catch (error) {
      toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
    } finally {
      setOauthConnecting(false);
    }
  }, [selectedDefId, selectedName, sourceName, savedSheetAtLoad, applyPick, knownPreviousName]);

  // The sheet row's own button. With a ref already in hand it costs only the Picker; without
  // one it has to run the whole flow, since a pick that no consent backs grants nothing.
  const handleChooseAnotherSheet = useCallback(async () => {
    if (!oauthRef) {
      await handleConnectGoogle();
      return;
    }

    setOauthConnecting(true);
    let refExpired = false;
    try {
      const spreadsheet = await pickSpreadsheetForRef(selectedName, oauthRef);
      applyPick(spreadsheet, knownPreviousName);
    } catch (error) {
      // Closing the Picker leaves the current sheet in place — not an error worth a toast.
      // Anything else means the ref's short TTL has run out, which a fresh consent fixes.
      refExpired = !(error instanceof PickerCancelledError);
    } finally {
      setOauthConnecting(false);
    }

    if (refExpired) await handleConnectGoogle();
  }, [oauthRef, selectedName, applyPick, handleConnectGoogle, knownPreviousName]);

  // WS check succeeded → persist the update (v1 pattern: test, then auto-save).
  const handleSaveSource = useCallback(async () => {
    const config = buildConfig();

    try {
      await updateSource(sourceId, {
        name: sourceName,
        sourceDefId: selectedDefId!,
        config,
        sourceId,
      });
      // source_type rides along on every update, same as SOURCE_CREATED — without
      // it, edits can't be broken down by connector in PostHog.
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_id: sourceId,
        source_type: selectedName,
        // Not own_key: a stored key's origin isn't recorded and Airbyte returns it masked, so
        // an edited source's key can't be attributed (see SOURCE_AUTH_MODES.SERVICE_ACCOUNT).
        // Create is where the real route is known.
        ...(isGoogleSheetsCustom ? { auth_mode: SOURCE_AUTH_MODES.SERVICE_ACCOUNT } : {}),
      });
      toastSuccess.updated('Source');
      mutateSource();
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [
    buildConfig,
    sourceId,
    sourceName,
    selectedDefId,
    selectedName,
    isGoogleSheetsCustom,
    mutateSource,
    onSuccess,
  ]);

  // Process WebSocket responses
  useEffect(() => {
    if (!lastMessage) return;

    try {
      const response = JSON.parse(lastMessage.data);

      // WebSocket call itself failed
      if (response.status !== 'success') {
        toastError.api(response.message || 'Connection test failed');
        setLoading(false);
        return;
      }

      // Connection test succeeded — save to backend
      if (response.data?.status === AIRBYTE_CHECK_SUCCEEDED) {
        handleSaveSource();
      } else {
        // Connection test failed — show logs
        setSetupLogs(response.data?.logs || []);
        toastError.api('Connection test failed');
        setLoading(false);
      }
    } catch {
      toastError.api('Invalid response from server');
      setLoading(false);
    }
  }, [lastMessage, handleSaveSource]);

  // Required-field check for the host-owned name field (the spec-driven fields
  // self-report via react-hook-form; the source type is locked in edit mode).
  // Sets the inline error and returns validity.
  const validateHostFields = useCallback(() => {
    const nameOk = !!sourceName.trim();
    setNameError(nameOk ? null : 'Source name is required');
    return nameOk;
  }, [sourceName]);

  // A fresh OAuth ref: redeem it into an update. The refresh_token lives only in
  // the server-side ref, so there's no client-side WS check here — the backend's
  // update_source runs Airbyte's connection check itself.
  const handleUpdateOAuthSource = useCallback(async () => {
    setSetupLogs([]);
    setLoading(true);
    try {
      await updateOAuthSource(sourceId, {
        sourceDefId: selectedDefId!,
        sourceName: selectedName,
        name: sourceName,
        config: buildConfig(),
        refresh_token_ref: oauthRef!,
      });
      trackEvent(ANALYTICS_EVENTS.SOURCE_UPDATED, {
        source_id: sourceId,
        source_type: 'Google Sheets',
        auth_mode: SOURCE_AUTH_MODES.OAUTH,
      });
      toastSuccess.updated('Source');
      mutateSource();
      onSuccess();
    } catch (error) {
      toastError.save(error, 'source');
    } finally {
      setLoading(false);
    }
  }, [
    selectedDefId,
    selectedName,
    sourceName,
    buildConfig,
    oauthRef,
    sourceId,
    mutateSource,
    onSuccess,
  ]);

  useEffect(() => {
    if (authSatisfied) setAuthError(null);
  }, [authSatisfied]);

  // Single submit: a fresh OAuth ref is redeemed directly; otherwise the config is
  // tested over the WebSocket and saved on success.
  const onSubmit = useCallback(() => {
    if (!validateHostFields()) return;
    // The spec is still in flight — nothing to build a config from yet, so swallow
    // the submit rather than sending a partial payload.
    if (!parsedSpec) return;

    if (isGoogleSheetsCustom && !authSatisfied) {
      setAuthError('Sign in with Google, or paste a service-account key');
      return;
    }

    if (oauthRef) {
      handleUpdateOAuthSource();
      return;
    }

    const config = buildConfig();
    setSetupLogs([]);
    setLoading(true);
    sendOrQueue({
      name: sourceName,
      sourceDefId: selectedDefId,
      config,
      sourceId,
    });
  }, [
    validateHostFields,
    parsedSpec,
    sourceName,
    selectedDefId,
    oauthRef,
    isGoogleSheetsCustom,
    authSatisfied,
    handleUpdateOAuthSource,
    buildConfig,
    sourceId,
    sendOrQueue,
  ]);

  // react-hook-form blocks onSubmit when a spec-driven field fails its own rules —
  // those fields render their own inline errors, but the host-owned name field
  // would stay silent, so validate it on the invalid path too.
  const onInvalid = useCallback(() => {
    validateHostFields();
  }, [validateHostFields]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent
        className={cn('max-h-[85vh] p-0 gap-0 flex flex-col overflow-hidden', 'sm:max-w-3xl')}
        preventOutsideClose
      >
        {/* Header typography matches the add-source wizard and the connection
            dialog: 2xl bold title + base-size description. */}
        <DialogHeader className="flex-shrink-0 space-y-2 border-b px-6 pt-6 pb-4 text-left">
          <DialogTitle className="text-2xl font-bold">Edit Source</DialogTitle>
          <DialogDescription className="text-base">
            Update your source connection settings.
          </DialogDescription>
        </DialogHeader>

        {/* Hold a single loader until the source AND its config spec are ready, so
            we never flash an empty form then a populated one. */}
        {!source || !selectedDefId || specLoading ? (
          <div
            data-testid="source-form-loading"
            className="flex flex-1 flex-col items-center justify-center gap-3 py-24 text-sm text-muted-foreground"
          >
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
            Loading source…
          </div>
        ) : (
          <form
            onSubmit={handleSubmit(onSubmit, onInvalid)}
            className="flex min-h-0 flex-1 flex-col"
            data-testid="source-form"
          >
            {/* Only this middle region scrolls; header + footer stay fixed. */}
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-none px-6 py-5">
              {/* Source Name */}
              <div>
                <Label htmlFor="source-name" className="text-base">
                  Source name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="source-name"
                  data-testid="source-name-input"
                  value={sourceName}
                  onChange={(e) => {
                    setSourceName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  placeholder="Enter source name"
                  disabled={loading}
                  className={cn('mt-1.5', nameError && 'border-destructive')}
                />
                {nameError && (
                  <p className="text-xs text-destructive mt-1" data-testid="source-name-error">
                    {nameError}
                  </p>
                )}
              </div>

              {/* Source type — fixed for an existing source, shown read-only so the
                  user can still see what they are editing. */}
              <div>
                <Label className="text-base">Source type</Label>
                <div
                  className="mt-1.5 flex items-center gap-2 rounded-md border bg-muted/50 px-3 py-2 text-base"
                  data-testid="source-type-display"
                >
                  <img
                    src={selectedDef?.icon || '/icons/connection.svg'}
                    alt=""
                    className="h-4 w-4 flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.src = '/icons/connection.svg';
                    }}
                  />
                  <span>{selectedName || '—'}</span>
                </div>
              </div>

              {/* Config body — custom/generic form and connection-test logs.
                Shared with the add-source wizard. */}
              <SourceConfigFields
                parsedSpec={parsedSpec}
                custom={custom}
                control={control}
                setValue={setValue}
                disabled={loading}
                mode="edit"
                onAuthSatisfiedChange={isGoogleSheetsCustom ? setAuthSatisfied : undefined}
                oauth={
                  isGoogleSheetsCustom
                    ? ({
                        connected: isConnected || !!oauthRef,
                        busy: oauthConnecting,
                        // "Re-" only makes sense once this source has actually used OAuth
                        // before (isConnected, from stored auth_type === 'Client'); a
                        // service-account-only source has never authenticated this way.
                        // The label names the action, which stays available after a sign-in
                        // (a token can always be refreshed); the tick beside it is what reports
                        // that this session already did it. Changing the sheet is its own
                        // button now, so this one no longer has to hint at both.
                        buttonLabel: isConnected
                          ? 'Re-authenticate with Google'
                          : 'Sign in with Google',
                        lockWhenConnected: false,
                        // The tick belongs to this session's sign-in, not to the source having
                        // been OAuth all along.
                        authedThisSession: !!oauthRef,
                        // Always: the grant a fresh token can act on is the one the Picker
                        // creates, so every re-authentication asks for the sheet again.
                        picksSheet: true,
                        onClick: handleConnectGoogle,
                        // The sheet row's own button, same as the wizard's. Changing a saved
                        // source's sheet is allowed but warned about, and this button runs
                        // consent first whenever no ref is held yet. A source switching off a
                        // service-account key has no OAuth sheet to replace, so until it signs
                        // in the only action is "Sign in with Google" — same as the wizard.
                        onReplaceSheet:
                          isConnected || oauthRef ? handleChooseAnotherSheet : undefined,
                        error: authError ?? undefined,
                        connectedSheet: pickedSheet ?? undefined,
                        // The card appends a link to the sheet it syncs today, so this text
                        // carries no link of its own.
                        // No trailing full stop: the card closes the sentence with a link. Names
                        // both sheets when Drive gave up the old one's title, so the user can
                        // tell what they are swapping without opening anything.
                        sheetWarning: mismatchWarning(sheetMismatch),
                        // Which file to find in the Picker: until a pick happens, and again
                        // whenever one missed, which is exactly when the user needs something
                        // to navigate by. Only when the saved value is a URL — the field also
                        // accepts a bare spreadsheet id, which would make a dead relative href.
                        linkToRepick: sheetToRepick,
                      } satisfies CustomSourceOAuth)
                    : undefined
                }
                setupLogs={setupLogs}
                logsTestId="connection-logs"
              />
            </div>

            {/* Footer — single "Save changes and test" button like v1 */}
            <DialogFooter className="flex-shrink-0 gap-2 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
                data-testid="source-cancel-btn"
              >
                Cancel
              </Button>
              {/* Test-and-save handles the service-account (and every non-Google) path. The
                Google OAuth button inside the form is the alternative create/re-auth action.
                Stays clickable while fields are empty so pressing it surfaces the inline
                required-field errors (onSubmit validates and blocks). Disabled only for
                states where a click genuinely can't do anything: a request in flight, or a
                chosen source whose spec is still loading (nothing to validate or submit). */}
              <Button
                type="submit"
                variant="primary"
                className="uppercase"
                disabled={loading || specLoading}
                data-testid="source-save-btn"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Save Changes And Test
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
