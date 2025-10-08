'use client';

import { RefObject, useCallback, useEffect } from 'react';

// Message types for parent-child communication
export interface IframeMessage {
  type: 'AUTH_UPDATE' | 'ORG_SWITCH' | 'AUTH_REQUEST' | 'READY' | 'LOGOUT';
  payload?: {
    token?: string;
    orgSlug?: string;
    timestamp?: number;
  };
  source: 'webapp_v2' | 'webapp';
}

interface UseIframeCommunicationProps {
  iframeRef: RefObject<HTMLIFrameElement>;
  targetOrigin?: string;
}

export function useIframeCommunication({
  iframeRef,
  targetOrigin = '*',
}: UseIframeCommunicationProps) {
  // Send message to iframe
  const sendMessage = useCallback(
    (message: IframeMessage) => {
      if (iframeRef.current?.contentWindow) {
        console.log('[Parent] Sending message to iframe:', message);
        iframeRef.current.contentWindow.postMessage(message, targetOrigin);
      } else {
        console.warn('[Parent] Iframe not ready, cannot send message');
      }
    },
    [iframeRef, targetOrigin]
  );

  // Send auth update with both token and org
  const sendAuthUpdate = useCallback(
    (token: string, orgSlug: string) => {
      sendMessage({
        type: 'AUTH_UPDATE',
        payload: {
          token,
          orgSlug,
          timestamp: Date.now(),
        },
        source: 'webapp_v2',
      });
    },
    [sendMessage]
  );

  // Send org switch only
  const sendOrgSwitch = useCallback(
    (orgSlug: string) => {
      sendMessage({
        type: 'ORG_SWITCH',
        payload: {
          orgSlug,
          timestamp: Date.now(),
        },
        source: 'webapp_v2',
      });
    },
    [sendMessage]
  );

  // Send logout signal
  const sendLogout = useCallback(() => {
    sendMessage({
      type: 'LOGOUT',
      payload: {
        timestamp: Date.now(),
      },
      source: 'webapp_v2',
    });
  }, [sendMessage]);

  // Request current auth state from child
  const requestAuthState = useCallback(() => {
    sendMessage({
      type: 'AUTH_REQUEST',
      source: 'webapp_v2',
    });
  }, [sendMessage]);

  return {
    sendMessage,
    sendAuthUpdate,
    sendOrgSwitch,
    sendLogout,
    requestAuthState,
  };
}
