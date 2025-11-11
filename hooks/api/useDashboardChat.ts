import { useState, useCallback } from 'react';
import { apiPost, apiGet } from '@/lib/api';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: {
    charts_analyzed?: number;
    data_included?: boolean;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}

export interface DashboardChatSettings {
  include_data: boolean;
  max_rows: number;
  provider_type?: string;
  auto_context: boolean;
}

export interface DashboardContext {
  dashboard: {
    id: number;
    title: string;
    description: string;
    dashboard_type: string;
    created_at: string;
    updated_at: string;
    filter_layout: any;
    target_screen_size: string;
  };
  charts: Array<{
    id: string;
    type: string;
    title: string;
    position: {
      x: number;
      y: number;
      w: number;
      h: number;
    };
    data_source: string;
    schema?: {
      columns: string[];
      metrics: string[];
      dimensions: string[];
      data_source: string;
      query_type: string;
    };
    sample_data?: {
      rows: any[];
      total_rows: number;
      columns: string[];
    };
  }>;
  filters: Array<{
    id: string;
    name: string;
    filter_type: string;
    source_table?: string;
    source_column?: string;
  }>;
  data_sources: string[];
  summary: {
    total_charts: number;
    chart_types: Record<string, number>;
    data_included: boolean;
    max_rows: number;
  };
}

export function useDashboardChat(dashboardId: number) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<DashboardContext | null>(null);

  const loadContext = useCallback(
    async (settings: Pick<DashboardChatSettings, 'include_data' | 'max_rows'>) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiPost(`/api/ai/dashboard/${dashboardId}/context`, {
          include_data: settings.include_data,
          max_rows: settings.max_rows,
        });

        setContext(response.context);
        return response.context;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to load dashboard context';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dashboardId]
  );

  const sendMessage = useCallback(
    async (
      messages: ChatMessage[],
      settings: DashboardChatSettings,
      selectedChartId?: string | null
    ) => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiPost(`/api/ai/dashboard/${dashboardId}/chat`, {
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            metadata: msg.metadata,
          })),
          include_data: settings.include_data,
          max_rows: settings.max_rows,
          selected_chart_id: selectedChartId,
          stream: false,
          provider_type: settings.provider_type,
        });

        return {
          content: response.content,
          usage: response.usage,
          context_included: response.context_included,
          data_included: response.data_included,
          metadata: response.metadata,
        };
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to send message';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dashboardId]
  );

  const updateSettings = useCallback(
    async (settings: DashboardChatSettings) => {
      try {
        await apiPost(`/api/ai/dashboard/${dashboardId}/chat-settings`, settings);
        return true;
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to update settings';
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    },
    [dashboardId]
  );

  const streamMessage = useCallback(
    async function* (
      messages: ChatMessage[],
      settings: DashboardChatSettings,
      selectedChartId?: string | null
    ): AsyncGenerator<{
      content: string;
      is_complete: boolean;
      usage?: any;
      context_included?: boolean;
    }> {
      setIsLoading(true);
      setError(null);

      try {
        const requestBody = {
          messages: messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
            metadata: msg.metadata,
          })),
          include_data: settings.include_data,
          max_rows: settings.max_rows,
          selected_chart_id: selectedChartId,
          stream: true,
          provider_type: settings.provider_type,
        };

        // Build API URL with base URL
        const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';

        // Get organization header like apiPost does
        const selectedOrgSlug =
          typeof window !== 'undefined' ? localStorage.getItem('selectedOrg') : undefined;

        const response = await fetch(`${API_BASE_URL}/api/ai/dashboard/${dashboardId}/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(selectedOrgSlug ? { 'x-dalgo-org': selectedOrgSlug } : {}),
          },
          credentials: 'include', // Send cookies for authentication
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                return;
              }

              try {
                const parsed = JSON.parse(data);
                if (parsed.error) {
                  throw new Error(parsed.error.message);
                }
                yield parsed;
              } catch (parseError) {
                console.error('Error parsing streaming response:', parseError);
              }
            }
          }
        }
      } catch (err: any) {
        const errorMessage = err.message || 'Failed to stream message';
        setError(errorMessage);
        throw new Error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [dashboardId]
  );

  return {
    isLoading,
    error,
    context,
    loadContext,
    sendMessage,
    streamMessage,
    updateSettings,
    clearError: () => setError(null),
  };
}
