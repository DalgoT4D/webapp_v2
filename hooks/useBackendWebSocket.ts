'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import useWebSocket, { ReadyState } from 'react-use-websocket';
import { generateWebSocketUrl, isAuthCloseCode } from '@/lib/websocket';
import { toastError } from '@/lib/toast';

// Reconnect config — shared across all backend WebSocket consumers
const RECONNECT_ATTEMPTS = 3;
const RECONNECT_INTERVAL_MS = 2000;

interface UseBackendWebSocketOptions {
  /** Controls whether the WebSocket connects. Pass false to disconnect. */
  enabled: boolean;
  /** Called when the connection is lost due to auth expiry or error. */
  onLoadingChange?: (loading: boolean) => void;
  /** Called with parsed JSON when a message is received. If not provided, use lastMessage. */
  onMessage?: (data: unknown) => void;
}

/**
 * Wrapper around react-use-websocket with shared backend config:
 * - Generates the WebSocket URL from a relative path
 * - Reconnect attempts + interval
 * - Auth-close detection with toast
 * - Error handling with toast
 * - Pending payload pattern: queue a message before the socket is open
 */
export function useBackendWebSocket(path: string, options: UseBackendWebSocketOptions) {
  const { enabled, onLoadingChange, onMessage } = options;

  const wsUrl = useMemo(() => generateWebSocketUrl(path), [path]);
  const pendingPayload = useRef<Record<string, unknown> | null>(null);

  const { sendJsonMessage, lastMessage, readyState } = useWebSocket(enabled ? wsUrl : null, {
    share: false,
    shouldReconnect: (closeEvent) => !isAuthCloseCode(closeEvent.code),
    reconnectAttempts: RECONNECT_ATTEMPTS,
    reconnectInterval: RECONNECT_INTERVAL_MS,
    onMessage: onMessage
      ? (event) => {
          try {
            onMessage(JSON.parse(event.data));
          } catch {
            toastError.api('Failed to parse server response');
            onLoadingChange?.(false);
          }
        }
      : undefined,
    onClose: (event) => {
      if (isAuthCloseCode(event.code)) {
        toastError.api('Session expired, please refresh the page');
        onLoadingChange?.(false);
      }
    },
    onError: () => {
      toastError.api('WebSocket connection error');
      onLoadingChange?.(false);
    },
  });

  // Flush pending payload once the socket opens
  useEffect(() => {
    if (readyState === ReadyState.OPEN && pendingPayload.current) {
      sendJsonMessage(pendingPayload.current);
      pendingPayload.current = null;
    }
  }, [readyState, sendJsonMessage]);

  /** Queue a message to send. If already connected, sends immediately. */
  const sendOrQueue = useCallback(
    (payload: Record<string, unknown>) => {
      if (readyState === ReadyState.OPEN) {
        sendJsonMessage(payload);
      } else {
        pendingPayload.current = payload;
      }
    },
    [readyState, sendJsonMessage]
  );

  return {
    sendJsonMessage,
    sendOrQueue,
    lastMessage,
    readyState,
    isConnected: readyState === ReadyState.OPEN,
  };
}
