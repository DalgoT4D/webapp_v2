import useSWR, { mutate } from 'swr';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type {
  ApiEnvelope,
  ChatHistoryMessage,
  ChatSession,
  ChatStatus,
} from '@/types/chat-with-data';

const BASE = '/api/chat-with-data';

/**
 * Invalidate every cached chat-session SWR key so the next render refetches.
 * Call after any mutation that changes session state on the server.
 */
function invalidateChatSessions() {
  return mutate((key) => typeof key === 'string' && key.startsWith(`${BASE}/sessions/`));
}

/** Whether chat is usable for this org, with the blocking reason if not */
export function useChatWithDataStatus() {
  const { data, error } = useSWR<ApiEnvelope<ChatStatus>>(`${BASE}/status`, apiGet, {
    revalidateOnFocus: false,
  });

  return {
    status: data?.data,
    isLoading: !error && !data,
    isError: error,
  };
}

export function useChatSessions() {
  const {
    data,
    error,
    mutate: refresh,
  } = useSWR<ApiEnvelope<ChatSession[]>>(`${BASE}/sessions/`, apiGet);

  return {
    sessions: data?.data || [],
    isLoading: !error && !data,
    isError: error,
    mutate: refresh,
  };
}

export function useChatSessionMessages(sessionId: number | null) {
  const {
    data,
    error,
    mutate: refresh,
  } = useSWR<ApiEnvelope<ChatHistoryMessage[]>>(
    sessionId ? `${BASE}/sessions/${sessionId}/messages` : null,
    apiGet
  );

  return {
    messages: data?.data || [],
    isLoading: !error && !data && !!sessionId,
    isError: error,
    mutate: refresh,
  };
}

export async function createChatSession(): Promise<ChatSession> {
  const result: ApiEnvelope<ChatSession> = await apiPost(`${BASE}/sessions/`, {});
  invalidateChatSessions();
  return result.data as ChatSession;
}

export async function renameChatSession(sessionId: number, title: string): Promise<ChatSession> {
  const result: ApiEnvelope<ChatSession> = await apiPut(`${BASE}/sessions/${sessionId}`, { title });
  invalidateChatSessions();
  return result.data as ChatSession;
}

export async function deleteChatSession(sessionId: number): Promise<void> {
  await apiDelete(`${BASE}/sessions/${sessionId}`);
  invalidateChatSessions();
}
