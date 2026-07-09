'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import { createSource, getSourceOAuthConsent, createOAuthSource } from '@/hooks/api/useSources';
import { openOAuthPopup } from '@/components/connectors/oauth-popup';
import { toastError, toastSuccess } from '@/lib/toast';

// WebSocket endpoint for source connection check — shared by SourceForm + the wizard
const SOURCE_CHECK_WS_PATH = 'airbyte/source/check_connection';

// Airbyte connection check returns 'succeeded' on success
const AIRBYTE_CHECK_SUCCEEDED = 'succeeded';

interface UseSourceSaveArgs {
  /** Selected source-definition id, or null before the user picks a source type */
  sourceDefId: string | null;
  /** Returns the cleaned connector config to send on save/connect */
  getConfig: () => Record<string, unknown>;
  /** Called with the newly created source's id once the save/connect flow succeeds */
  onSaved: (sourceId: string) => void;
}

interface UseSourceSave {
  /** Runs the WS check_connection → createSource flow */
  save: (name: string) => void;
  /** Runs the Google OAuth consent → popup(ref) → createOAuthSource flow */
  connectGoogle: (name: string) => Promise<void>;
  loading: boolean;
  oauthConnecting: boolean;
  setupLogs: string[];
}

/**
 * Shared source-create logic: test the connection over the backend WebSocket, then
 * create the source on success — plus the "Sign in with Google" OAuth connect flow
 * for Google Sheets. Used by the legacy SourceForm and the source-add wizard's step 2.
 */
export function useSourceSave({
  sourceDefId,
  getConfig,
  onSaved,
}: UseSourceSaveArgs): UseSourceSave {
  const [loading, setLoading] = useState(false);
  const [oauthConnecting, setOauthConnecting] = useState(false);
  const [setupLogs, setSetupLogs] = useState<string[]>([]);
  const [pendingName, setPendingName] = useState<string | null>(null);

  const { sendOrQueue, lastMessage } = useBackendWebSocket(SOURCE_CHECK_WS_PATH, {
    enabled: loading,
    onLoadingChange: setLoading,
  });

  const save = useCallback(
    (name: string) => {
      if (!sourceDefId || !name.trim()) return;
      setSetupLogs([]);
      setPendingName(name);
      setLoading(true);
      sendOrQueue({ name, sourceDefId, config: getConfig() });
    },
    [sourceDefId, getConfig, sendOrQueue]
  );

  useEffect(() => {
    if (!lastMessage) return;
    (async () => {
      try {
        const response = JSON.parse(lastMessage.data);
        if (response.status !== 'success') {
          toastError.api(response.message || 'Connection test failed');
          setLoading(false);
          return;
        }
        if (response.data?.status === AIRBYTE_CHECK_SUCCEEDED) {
          const created = await createSource({
            name: pendingName!,
            sourceDefId: sourceDefId!,
            config: getConfig(),
          });
          toastSuccess.created('Source');
          setLoading(false);
          onSaved(created.sourceId);
        } else {
          setSetupLogs(response.data?.logs || []);
          toastError.api('Connection test failed');
          setLoading(false);
        }
      } catch {
        toastError.api('Invalid response from server');
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastMessage]);

  const connectGoogle = useCallback(
    async (name: string) => {
      if (!sourceDefId || !name.trim()) {
        toastError.api('Enter a source name first');
        return;
      }
      setOauthConnecting(true);
      try {
        const config = getConfig();
        const { authUrl } = await getSourceOAuthConsent(sourceDefId);
        const { ref } = await openOAuthPopup(authUrl);
        const { sourceId } = await createOAuthSource({
          sourceDefId,
          name,
          config,
          ref,
        });
        toastSuccess.generic('Source created');
        onSaved(sourceId);
      } catch (error) {
        toastError.api(error instanceof Error ? error.message : 'Google sign-in failed');
      } finally {
        setOauthConnecting(false);
      }
    },
    [sourceDefId, getConfig, onSaved]
  );

  return { save, connectGoogle, loading, oauthConnecting, setupLogs };
}
