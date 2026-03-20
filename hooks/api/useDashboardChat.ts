'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

type DashboardChatEventType = 'progress' | 'assistant_message' | 'error';

interface DashboardChatCitation {
  source_type: string;
  source_identifier: string;
  title: string;
  snippet: string;
  dashboard_id?: number | null;
  table_name?: string | null;
}

interface DashboardChatRelatedDashboard {
  dashboard_id: number;
  title: string;
  reason: string;
}

interface DashboardChatAssistantPayload {
  intent?: string;
  citations?: DashboardChatCitation[];
  related_dashboards?: DashboardChatRelatedDashboard[];
  warnings?: string[];
  sql?: string | null;
  sql_results?: Array<Record<string, unknown>> | null;
  metadata?: Record<string, unknown>;
}

export interface DashboardChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  payload?: DashboardChatAssistantPayload;
}

interface DashboardChatEvent {
  event_type: DashboardChatEventType;
  dashboard_id: number;
  occurred_at: string;
  session_id?: string;
  message_id?: string;
  data: Record<string, unknown>;
}

interface UseDashboardChatOptions {
  dashboardId: number;
  enabled: boolean;
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
  const socketRef = useRef<WebSocket | null>(null);
  const [messages, setMessages] = useState<DashboardChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const websocketUrl = useMemo(() => {
    if (!enabled || !selectedOrgSlug) {
      return null;
    }
    return buildDashboardChatSocketUrl(dashboardId, selectedOrgSlug);
  }, [dashboardId, enabled, selectedOrgSlug]);

  useEffect(() => {
    if (!websocketUrl) {
      setIsConnected(false);
      return undefined;
    }

    const socket = new WebSocket(websocketUrl);
    socketRef.current = socket;

    socket.onopen = () => {
      setIsConnected(true);
      setError(null);
    };

    socket.onmessage = (event) => {
      let payload: DashboardChatEvent;
      try {
        payload = JSON.parse(event.data);
      } catch {
        setError('Received an invalid chat response');
        setIsThinking(false);
        return;
      }

      if (payload.session_id) {
        setSessionId(payload.session_id);
      }

      if (payload.event_type === 'progress') {
        setIsThinking(true);
        setError(null);
        return;
      }

      if (payload.event_type === 'assistant_message') {
        const messageData = payload.data;
        setIsThinking(false);
        setError(null);
        setMessages((previousMessages) => [
          ...previousMessages,
          {
            id: String(messageData.id || payload.message_id || `assistant-${Date.now()}`),
            role: 'assistant',
            content: String(messageData.content || ''),
            createdAt: String(messageData.created_at || payload.occurred_at),
            payload: (messageData.payload as DashboardChatAssistantPayload | undefined) || {},
          },
        ]);
        return;
      }

      if (payload.event_type === 'error') {
        setIsThinking(false);
        setError(
          typeof payload.data.message === 'string'
            ? payload.data.message
            : 'Something went wrong while generating the response'
        );
      }
    };

    socket.onerror = () => {
      setError('The chat connection encountered an error');
    };

    socket.onclose = () => {
      setIsConnected(false);
      socketRef.current = null;
    };

    return () => {
      socket.close();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [websocketUrl]);

  const sendMessage = (content: string) => {
    const trimmedContent = content.trim();
    const socket = socketRef.current;

    if (!trimmedContent || !socket || socket.readyState !== WebSocket.OPEN) {
      setError('Chat connection is not ready yet');
      return false;
    }

    const clientMessageId = `client-${Date.now()}`;
    const createdAt = new Date().toISOString();

    setMessages((previousMessages) => [
      ...previousMessages,
      {
        id: clientMessageId,
        role: 'user',
        content: trimmedContent,
        createdAt,
      },
    ]);
    setIsThinking(true);
    setError(null);

    socket.send(
      JSON.stringify({
        action: 'send_message',
        message: trimmedContent,
        client_message_id: clientMessageId,
        ...(sessionId ? { session_id: sessionId } : {}),
      })
    );

    return true;
  };

  const resetChat = () => {
    setMessages([]);
    setSessionId(null);
    setIsThinking(false);
    setError(null);
  };

  return {
    messages,
    sessionId,
    isConnected,
    isThinking,
    error,
    sendMessage,
    resetChat,
  };
}
