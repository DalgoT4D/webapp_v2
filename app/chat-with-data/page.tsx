'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Lock, Database, MessageSquareOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { toastError } from '@/lib/toast';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import {
  createChatSession,
  deleteChatSession,
  renameChatSession,
  useChatSessionMessages,
  useChatSessions,
  useChatWithDataStatus,
} from '@/hooks/api/useChatSessions';
import { historyToChatMessages, useChatWithData } from '@/hooks/useChatWithData';
import { SessionSidebar } from '@/components/chat-with-data/SessionSidebar';
import { ChatPane } from '@/components/chat-with-data/ChatPane';
import type { ChatStatusReason } from '@/types/chat-with-data';

const BLOCKED_STATES: Record<
  Exclude<ChatStatusReason, 'ok'>,
  { icon: typeof Lock; heading: string; body: string }
> = {
  feature_disabled: {
    icon: MessageSquareOff,
    heading: 'Chat with Data is not enabled',
    body: 'This feature is not switched on for your organization yet. Reach out to the Dalgo team to enable it.',
  },
  llm_consent_required: {
    icon: Lock,
    heading: 'AI features need approval',
    body: 'Your organization has not yet approved the use of AI features. Ask your admin to enable AI data analysis in settings.',
  },
  no_warehouse: {
    icon: Database,
    heading: 'Connect a warehouse first',
    body: 'Chat with Data answers questions from your data warehouse. Set up your warehouse before using chat.',
  },
};

function BlockedState({ reason }: { reason: ChatStatusReason }) {
  const state = BLOCKED_STATES[reason as Exclude<ChatStatusReason, 'ok'>];
  if (!state) return null;
  const Icon = state.icon;
  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
      data-testid="chat-blocked-state"
    >
      <Icon className="h-10 w-10 text-muted-foreground/50" />
      <h2 className="text-lg font-semibold">{state.heading}</h2>
      <p className="max-w-md text-sm text-muted-foreground">{state.body}</p>
    </div>
  );
}

export default function ChatWithDataPage() {
  const { status, isLoading: statusLoading, isError: statusError } = useChatWithDataStatus();
  const { sessions, mutate: refreshSessions } = useChatSessions();
  const [activeSessionId, setActiveSessionId] = useState<number | null>(null);
  // question typed before any session existed; sent once the new session's socket is up
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);

  const { messages: history } = useChatSessionMessages(activeSessionId);
  const initialMessages = useMemo(() => historyToChatMessages(history), [history]);

  const onTitleUpdated = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  const { messages, sendMessage, isStreaming } = useChatWithData(activeSessionId, {
    enabled: Boolean(status?.enabled),
    initialMessages,
    onTitleUpdated,
  });

  useEffect(() => {
    if (pendingQuestion && activeSessionId) {
      sendMessage(pendingQuestion);
      setPendingQuestion(null);
    }
  }, [pendingQuestion, activeSessionId, sendMessage]);

  const handleNewChat = async () => {
    try {
      const session = await createChatSession();
      setActiveSessionId(session.id);
      trackEvent(ANALYTICS_EVENTS.CHAT_SESSION_CREATED);
    } catch {
      toastError.api('Could not start a new chat');
    }
  };

  const handleSend = async (question: string) => {
    trackEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT);
    if (activeSessionId) {
      sendMessage(question);
      return;
    }
    try {
      const session = await createChatSession();
      setActiveSessionId(session.id);
      setPendingQuestion(question);
      trackEvent(ANALYTICS_EVENTS.CHAT_SESSION_CREATED);
    } catch {
      toastError.api('Could not start a new chat');
    }
  };

  const handleRename = async (sessionId: number, title: string) => {
    try {
      await renameChatSession(sessionId, title);
      trackEvent(ANALYTICS_EVENTS.CHAT_SESSION_RENAMED);
    } catch {
      toastError.api('Could not rename the chat');
    }
  };

  const handleDelete = async (sessionId: number) => {
    try {
      await deleteChatSession(sessionId);
      if (sessionId === activeSessionId) setActiveSessionId(null);
      trackEvent(ANALYTICS_EVENTS.CHAT_SESSION_DELETED);
    } catch {
      toastError.api('Could not delete the chat');
    }
  };

  if (statusLoading) {
    return (
      <div className="flex h-full gap-4 p-4">
        <Skeleton className="h-full w-64" />
        <Skeleton className="h-full flex-1" />
      </div>
    );
  }

  if (statusError || !status) {
    return <BlockedState reason="feature_disabled" />;
  }

  if (!status.enabled) {
    return <BlockedState reason={status.reason} />;
  }

  return (
    <div className="flex h-full bg-background">
      <div className="hidden md:flex">
        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelect={setActiveSessionId}
          onNewChat={handleNewChat}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </div>
      <ChatPane messages={messages} isStreaming={isStreaming} onSend={handleSend} />
    </div>
  );
}
