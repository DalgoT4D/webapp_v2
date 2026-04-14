'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/authStore';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiPost } from '@/lib/api';

type DashboardChatEventType = 'progress' | 'assistant_message' | 'cancelled';
type DashboardChatFeedback = 'thumbs_up' | 'thumbs_down';

interface DashboardChatCitation {
  source_type: string;
  source_identifier: string;
  title: string;
  snippet: string;
  url?: string | null;
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
  feedback?: DashboardChatFeedback | null;
  payload?: DashboardChatAssistantPayload;
}

// Base fields present on every event from the backend.
interface DashboardChatBaseEvent {
  event_type: DashboardChatEventType;
  dashboard_id: number;
  occurred_at: string;
  session_id?: string;
  turn_id?: string;
  message_id?: string;
}

interface DashboardChatProgressEvent extends DashboardChatBaseEvent {
  event_type: 'progress';
  label: string;
  stage?: string | null;
}

interface DashboardChatCancelledEvent extends DashboardChatBaseEvent {
  event_type: 'cancelled';
  label: string;
}

interface DashboardChatAssistantMessageEvent extends DashboardChatBaseEvent {
  event_type: 'assistant_message';
  id: string;
  role: 'assistant';
  content: string;
  created_at: string;
  feedback?: DashboardChatFeedback | null;
  payload?: DashboardChatAssistantPayload;
}

type DashboardChatEvent =
  | DashboardChatProgressEvent
  | DashboardChatCancelledEvent
  | DashboardChatAssistantMessageEvent;

interface DashboardChatEnvelope {
  message: string;
  status: 'success' | 'error';
  data: DashboardChatEvent | Record<string, never>;
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
  const activeTurnIdRef = useRef<string | null>(null);
  const sendRef = useRef<(data: string) => boolean>(() => false);

  const [messages, setMessages] = useState<DashboardChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [progressLabel, setProgressLabel] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [feedbackSubmittingById, setFeedbackSubmittingById] = useState<Record<string, boolean>>({});

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
      setProgressLabel('Understanding question');
      setChatError(null);
    }
  }, [buildPayload]);

  const handleClose = useCallback(() => {
    setIsThinking(false);
    setIsCancelling(false);
    setProgressLabel(null);
  }, []);

  const handleMessage = useCallback((raw: string) => {
    let envelope: DashboardChatEnvelope;
    try {
      envelope = JSON.parse(raw);
    } catch {
      setChatError('Received an invalid chat response');
      setIsThinking(false);
      setIsCancelling(false);
      setProgressLabel(null);
      return;
    }

    if (envelope.status === 'error') {
      setIsThinking(false);
      setIsCancelling(false);
      setProgressLabel(null);
      activeTurnIdRef.current = null;
      setChatError(envelope.message || 'Something went wrong while generating the response');
      return;
    }

    const event = envelope.data;
    if (!('event_type' in event)) {
      setChatError('Received an invalid chat response');
      setIsThinking(false);
      setIsCancelling(false);
      setProgressLabel(null);
      return;
    }

    if (event.session_id) {
      sessionIdRef.current = event.session_id;
      setSessionId(event.session_id);
    }
    activeTurnIdRef.current = event.turn_id || null;

    if (event.event_type === 'progress') {
      setIsThinking(true);
      setIsCancelling(event.stage === 'cancelling');
      setProgressLabel(event.label);
      setChatError(null);
      return;
    }

    if (event.event_type === 'cancelled') {
      setIsThinking(false);
      setIsCancelling(false);
      setProgressLabel(null);
      setChatError(null);
      activeTurnIdRef.current = null;
      return;
    }

    if (event.event_type === 'assistant_message') {
      setIsThinking(false);
      setIsCancelling(false);
      setProgressLabel(null);
      setChatError(null);
      activeTurnIdRef.current = null;
      setMessages((previousMessages) => [
        ...previousMessages,
        {
          id: event.id || event.message_id || `assistant-${Date.now()}`,
          role: 'assistant',
          content: event.content,
          createdAt: event.created_at || event.occurred_at,
          feedback: event.feedback || null,
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

      if (pendingMessageRef.current) {
        setChatError('Wait for the current message to connect before sending another one');
        return false;
      }

      const clientMessageId = `client-${Date.now()}`;
      const createdAt = new Date().toISOString();

      const sent = send(buildPayload(trimmedContent, clientMessageId));
      if (sent) {
        setMessages((previousMessages) => [
          ...previousMessages,
          { id: clientMessageId, role: 'user', content: trimmedContent, createdAt },
        ]);
        setChatError(null);
        setIsThinking(true);
        setIsCancelling(false);
        setProgressLabel('Understanding question');
      } else {
        // Socket not ready — queue for when connection opens
        pendingMessageRef.current = { content: trimmedContent, clientMessageId };
        setMessages((previousMessages) => [
          ...previousMessages,
          { id: clientMessageId, role: 'user', content: trimmedContent, createdAt },
        ]);
        setChatError(null);
      }
      return true;
    },
    [send, buildPayload]
  );

  const resetChat = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    activeTurnIdRef.current = null;
    setSessionId(null);
    setIsThinking(false);
    setIsCancelling(false);
    setProgressLabel(null);
    setChatError(null);
  }, []);

  const cancelMessage = useCallback((): boolean => {
    if (!sessionIdRef.current) {
      setChatError('No active chat session to stop');
      return false;
    }
    const sent = send(
      JSON.stringify({
        action: 'cancel_message',
        session_id: sessionIdRef.current,
        ...(activeTurnIdRef.current ? { turn_id: activeTurnIdRef.current } : {}),
      })
    );
    if (!sent) {
      setChatError('Unable to stop the message right now');
      return false;
    }
    setIsCancelling(true);
    setProgressLabel('Stopping...');
    return true;
  }, [send]);

  const submitFeedback = useCallback(
    async (messageId: string, feedback: DashboardChatFeedback): Promise<boolean> => {
      if (feedbackSubmittingById[messageId]) {
        return false;
      }

      const existingMessage = messages.find((message) => message.id === messageId);
      if (!existingMessage || existingMessage.role !== 'assistant' || existingMessage.feedback) {
        return false;
      }

      setFeedbackSubmittingById((current) => ({ ...current, [messageId]: true }));
      try {
        const response = await apiPost(
          `/api/dashboards/${dashboardId}/chat/messages/${messageId}/feedback/`,
          { feedback }
        );
        const storedFeedback = response.feedback === 'thumbs_down' ? 'thumbs_down' : 'thumbs_up';
        setMessages((currentMessages) =>
          currentMessages.map((message) =>
            message.id === messageId ? { ...message, feedback: storedFeedback } : message
          )
        );
        return true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Unable to save feedback for this answer';
        toast.error(message);
        return false;
      } finally {
        setFeedbackSubmittingById((current) => {
          const nextState = { ...current };
          delete nextState[messageId];
          return nextState;
        });
      }
    },
    [dashboardId, feedbackSubmittingById, messages]
  );

  return {
    messages,
    sessionId,
    isConnected,
    isThinking,
    isCancelling,
    progressLabel,
    error: chatError || wsError,
    sendMessage,
    cancelMessage,
    submitFeedback,
    feedbackSubmittingById,
    resetChat,
  };
}
