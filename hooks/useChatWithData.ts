'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBackendWebSocket } from '@/hooks/useBackendWebSocket';
import type {
  ChatHistoryMessage,
  ChatMessage,
  ChatWsEvent,
  ToolActivity,
} from '@/types/chat-with-data';

// Client-side render keys; not sent to the backend
let messageCounter = 0;
function nextMessageId(): string {
  messageCounter += 1;
  return `msg-${messageCounter}`;
}

export function newUserMessage(content: string): ChatMessage {
  return { id: nextMessageId(), role: 'user', content, streaming: false, tools: [] };
}

/** The assistant bubble a turn streams into, appended right after the user's question */
export function newAssistantPlaceholder(): ChatMessage {
  return { id: nextMessageId(), role: 'assistant', content: '', streaming: true, tools: [] };
}

function updateLastAssistant(
  messages: ChatMessage[],
  update: (message: ChatMessage) => ChatMessage
): ChatMessage[] {
  const index = messages.length - 1;
  if (index < 0 || messages[index].role !== 'assistant') return messages;
  const next = messages.slice();
  next[index] = update(messages[index]);
  return next;
}

/** Settle every still-pending approval/question card (approved the query,
 *  cancelled it, or answered the agent's question) */
export function resolvePendingInput(
  messages: ChatMessage[],
  status: 'approved' | 'cancelled' | 'answered'
): ChatMessage[] {
  return messages.map((message) =>
    message.inputRequest?.status === 'pending'
      ? { ...message, inputRequest: { ...message.inputRequest, status } }
      : message
  );
}

/**
 * Pure reducer: one WebSocket event applied to the message list.
 * Events always target the trailing assistant placeholder (one turn in flight
 * at a time — the backend enforces this with a per-session lock).
 */
export function applyChatEvent(messages: ChatMessage[], event: ChatWsEvent): ChatMessage[] {
  switch (event.type) {
    case 'token':
      return updateLastAssistant(messages, (message) => ({
        ...message,
        content: message.content + event.text,
      }));

    case 'tool_start': {
      const tool: ToolActivity = {
        tool: event.tool,
        label: event.label,
        sql: event.sql,
        status: 'running',
      };
      return updateLastAssistant(messages, (message) => ({
        ...message,
        tools: [...message.tools, tool],
      }));
    }

    case 'tool_end':
      return updateLastAssistant(messages, (message) => {
        // close the most recent still-running activity for this tool
        const tools = message.tools.slice();
        for (let i = tools.length - 1; i >= 0; i -= 1) {
          if (tools[i].tool === event.tool && tools[i].status === 'running') {
            tools[i] = { ...tools[i], status: event.status };
            break;
          }
        }
        return { ...message, tools };
      });

    case 'message_complete':
      return updateLastAssistant(messages, (message) => ({
        ...message,
        content: event.message || message.content,
        resultTable: event.result_table ?? null,
        charts: event.charts || [],
        streaming: false,
      }));

    case 'validation':
      return updateLastAssistant(messages, (message) => ({
        ...message,
        validation: { verdict: event.verdict, caveat: event.caveat },
      }));

    case 'input_required': {
      // human-in-the-loop pause: attach the approval/question card to the
      // assistant bubble and stop the streaming state
      const attach = (message: ChatMessage): ChatMessage => ({
        ...message,
        streaming: false,
        // a lone ask_user call reads as the assistant asking in plain chat
        content:
          event.kind === 'question' && !message.content ? event.question || '' : message.content,
        // gated tools never actually started — drop their running spinners
        tools: message.tools.filter(
          (activity) =>
            !(
              activity.status === 'running' &&
              event.requests.some((request) => request.tool === activity.tool)
            )
        ),
        inputRequest: {
          kind: event.kind,
          requests: event.requests || [],
          question: event.question,
          status: 'pending',
        },
      });
      const last = messages[messages.length - 1];
      if (!last || last.role !== 'assistant') {
        // reconnect replay: the card is re-sent on connect with no live turn
        return [...messages, attach(newAssistantPlaceholder())];
      }
      return updateLastAssistant(messages, attach);
    }

    case 'error':
      return updateLastAssistant(messages, (message) => ({
        ...message,
        error: event.message,
        streaming: false,
      }));

    case 'title_updated':
      // session metadata, not conversation state — handled by the hook callback
      return messages;

    default:
      return messages;
  }
}

/** Map replayed REST history (useChatSessionMessages) into live-chat bubbles */
export function historyToChatMessages(history: ChatHistoryMessage[]): ChatMessage[] {
  return history.map((message, index) => {
    const attachments = message.sql_attachments || [];
    const tools: ToolActivity[] = attachments.map((attachment) => ({
      tool: 'execute_sql',
      label: 'Ran a query',
      sql: attachment.sql,
      status: attachment.status === 'success' ? 'success' : 'error',
    }));
    const lastResult = [...attachments]
      .reverse()
      .find((attachment) => attachment.status === 'success' && attachment.columns?.length);

    return {
      id: `history-${index}`,
      role: message.role,
      content: message.content,
      streaming: false,
      tools,
      resultTable: lastResult
        ? {
            columns: lastResult.columns as string[],
            rows: (lastResult.rows as string[][]) || [],
            row_count: lastResult.row_count ?? (lastResult.rows?.length || 0),
          }
        : null,
      charts: message.charts || [],
    };
  });
}

interface UseChatWithDataOptions {
  /** Connect only when the session exists and chat is enabled */
  enabled: boolean;
  /** History replayed from the REST endpoint, shown before any live turn */
  initialMessages?: ChatMessage[];
  /** Fired when the backend auto-titles the session after the first turn */
  onTitleUpdated?: (title: string) => void;
}

export function useChatWithData(sessionId: number | null, options: UseChatWithDataOptions) {
  const { enabled, initialMessages, onTitleUpdated } = options;
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages || []);
  const [isStreaming, setIsStreaming] = useState(false);

  // keep the latest callback without re-subscribing the socket
  const onTitleUpdatedRef = useRef(onTitleUpdated);
  onTitleUpdatedRef.current = onTitleUpdated;

  // switching sessions replaces the conversation
  const lastSessionRef = useRef<number | null>(sessionId);
  useEffect(() => {
    if (lastSessionRef.current !== sessionId) {
      lastSessionRef.current = sessionId;
      setMessages(initialMessages || []);
      setIsStreaming(false);
      // a new session is a fresh conversation — allow its history to merge
      // even if a live turn happened in the previous session
      liveTurnStartedRef.current = false;
    }
  }, [sessionId, initialMessages]);

  // history often arrives after the socket is already open — merge it in
  // unless a live turn has already started
  const liveTurnStartedRef = useRef(false);
  useEffect(() => {
    if (initialMessages && initialMessages.length > 0 && !liveTurnStartedRef.current) {
      setMessages(initialMessages);
    }
  }, [initialMessages]);

  const handleEvent = useCallback((data: unknown) => {
    const event = data as ChatWsEvent;
    if (event.type === 'title_updated') {
      onTitleUpdatedRef.current?.(event.title);
      return;
    }
    if (
      event.type === 'message_complete' ||
      event.type === 'error' ||
      event.type === 'input_required'
    ) {
      // input_required: the turn is paused server-side — free the composer so
      // the user can answer (question) or approve/cancel (approval card)
      setIsStreaming(false);
    }
    setMessages((current) => applyChatEvent(current, event));
  }, []);

  const { sendOrQueue, isConnected } = useBackendWebSocket(`chat-with-data/${sessionId}/`, {
    enabled: enabled && sessionId !== null,
    onMessage: handleEvent,
  });

  const sendMessage = useCallback(
    (question: string, model?: string) => {
      const trimmed = question.trim();
      if (!trimmed || isStreaming) return;
      liveTurnStartedRef.current = true;
      // an open ask_user question is answered by this message — settle its card
      setMessages((current) => [
        ...resolvePendingInput(current, 'answered'),
        newUserMessage(trimmed),
        newAssistantPlaceholder(),
      ]);
      setIsStreaming(true);
      sendOrQueue({ action: 'send_message', message: trimmed, ...(model ? { model } : {}) });
    },
    [isStreaming, sendOrQueue]
  );

  /** Answer a pending approval card; the backend resumes the paused turn */
  const respondToApproval = useCallback(
    (approve: boolean) => {
      liveTurnStartedRef.current = true;
      setMessages((current) => [
        ...resolvePendingInput(current, approve ? 'approved' : 'cancelled'),
        // the resumed turn streams into a fresh assistant bubble below the card
        newAssistantPlaceholder(),
      ]);
      setIsStreaming(true);
      sendOrQueue({ action: 'resume_approval', approve });
    },
    [sendOrQueue]
  );

  return { messages, sendMessage, respondToApproval, isStreaming, isConnected };
}
