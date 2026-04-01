'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';

type DashboardChatEventType = 'progress' | 'assistant_message';

interface DashboardChatCitation {
  source_type: string;
  source_identifier: string;
  title: string;
  snippet: string;
  dashboard_id?: number | null;
  table_name?: string | null;
}

type DashboardChatResponseFormat = 'text' | 'table' | 'text_with_table';

interface DashboardChatAssistantMetadata {
  response_format?: DashboardChatResponseFormat;
  table_columns?: string[];
  [key: string]: unknown;
}

interface DashboardChatAssistantPayload {
  intent?: string;
  citations?: DashboardChatCitation[];
  warnings?: string[];
  sql?: string | null;
  sql_results?: Array<Record<string, unknown>> | null;
  metadata?: DashboardChatAssistantMetadata;
}

export interface DashboardChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  payload?: DashboardChatAssistantPayload;
}

// Base fields present on every event from the backend.
interface DashboardChatBaseEvent {
  event_type: DashboardChatEventType;
  dashboard_id: number;
  occurred_at: string;
  session_id?: string;
  message_id?: string;
}

// Assistant message events carry message fields directly (no nested data).
interface DashboardChatProgressEvent extends DashboardChatBaseEvent {
  event_type: 'progress';
}

interface DashboardChatAssistantMessageEvent extends DashboardChatBaseEvent {
  event_type: 'assistant_message';
  id: string;
  role: 'assistant';
  content: string;
  created_at: string;
  payload?: DashboardChatAssistantPayload;
}

type DashboardChatEvent = DashboardChatProgressEvent | DashboardChatAssistantMessageEvent;

// Every WebSocket message from the backend is wrapped in this envelope.
interface DashboardChatEnvelope {
  message: string;
  status: 'success' | 'error';
  data: DashboardChatEvent;
}

interface UseDashboardChatOptions {
  dashboardId: number;
  enabled: boolean;
}

interface PendingDashboardChatMessage {
  content: string;
  clientMessageId: string;
}

function getSelectedOrgSlug() {
  if (typeof window === 'undefined') {
    return null;
  }
  return localStorage.getItem('selectedOrg');
}

function buildDashboardChatSocketUrl(dashboardId: number, orgSlug: string) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
  const websocketUrl = new URL(backendUrl);
  websocketUrl.protocol = websocketUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  websocketUrl.pathname = `/wss/dashboards/${dashboardId}/chat/`;
  websocketUrl.searchParams.set('orgslug', orgSlug);
  return websocketUrl.toString();
}

export function useDashboardChat({ dashboardId, enabled }: UseDashboardChatOptions) {
  const selectedOrgSlug = useAuthStore((state) => state.selectedOrgSlug) || getSelectedOrgSlug();
  const pendingMessageRef = useRef<PendingDashboardChatMessage | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  // sendRef lets onOpen call send() before it's returned from useWebSocket
  const sendRef = useRef<(data: string) => boolean>(() => false);

  const [messages, setMessages] = useState<DashboardChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);

  const websocketUrl = useMemo(() => {
    if (!enabled || !selectedOrgSlug) {
      return null;
    }
    return buildDashboardChatSocketUrl(dashboardId, selectedOrgSlug);
  }, [dashboardId, enabled, selectedOrgSlug]);

  const buildPayload = useCallback(
    (content: string, clientMessageId: string) =>
      JSON.stringify({
        action: 'send_message',
        message: content,
        client_message_id: clientMessageId,
        ...(sessionIdRef.current ? { session_id: sessionIdRef.current } : {}),
      }),
    []
  );

  const handleOpen = useCallback(() => {
    const pending = pendingMessageRef.current;
    if (!pending) {
      return;
    }
    const sent = sendRef.current(buildPayload(pending.content, pending.clientMessageId));
    if (sent) {
      pendingMessageRef.current = null;
      setIsThinking(true);
      setChatError(null);
    }
  }, [buildPayload]);

  const handleClose = useCallback(() => {
    setIsThinking(false);
  }, []);

  const handleMessage = useCallback((raw: string) => {
    let envelope: DashboardChatEnvelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      setChatError('Received an invalid chat response');
      setIsThinking(false);
      return;
    }

    if (envelope.status === 'error') {
      setIsThinking(false);
      setChatError(envelope.message || 'Something went wrong while generating the response');
      return;
    }

    const event = envelope.data;

    if (event.session_id) {
      sessionIdRef.current = event.session_id;
      setSessionId(event.session_id);
    }

    if (event.event_type === 'progress') {
      setIsThinking(true);
      setChatError(null);
      return;
    }

    if (event.event_type === 'assistant_message') {
      setIsThinking(false);
      setChatError(null);
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: event.id || event.message_id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: event.content,
          createdAt: event.created_at || event.occurred_at,
          payload: event.payload || {},
        },
      ]);
    }
  }, []);

  const {
    isConnected,
    send,
    error: wsError,
  } = useWebSocket({
    url: websocketUrl,
    onMessage: handleMessage,
    onOpen: handleOpen,
    onClose: handleClose,
  });

  // Keep sendRef in sync so handleOpen can always call the latest send
  sendRef.current = send;

  const sendMessage = useCallback(
    (content: string): boolean => {
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return false;
      }

      const clientMessageId = `client-${Date.now()}`;
      const createdAt = new Date().toISOString();

      setMessages((previousMessages) => [
        ...previousMessages,
        { id: clientMessageId, role: 'user', content: trimmedContent, createdAt },
      ]);
      setChatError(null);

      const sent = send(buildPayload(trimmedContent, clientMessageId));
      if (sent) {
        setIsThinking(true);
      } else {
        // Socket not ready — queue for when connection opens
        pendingMessageRef.current = { content: trimmedContent, clientMessageId };
      }
      return true;
    },
    [send, buildPayload]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    setSessionId(null);
    setIsThinking(false);
    setChatError(null);
  }, []);

  return {
    messages,
    sessionId,
    isConnected,
    isThinking,
    error: chatError || wsError,
    sendMessage,
    resetChat,
  };
}
