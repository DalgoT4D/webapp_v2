'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { ConversationDock } from '@/components/chat-with-data/ConversationDock';
import { ChatHeadbar } from '@/components/chat-with-data/ChatHeadbar';
import { ChatPane } from '@/components/chat-with-data/ChatPane';
import type { ChatStatusReason } from '@/types/chat-with-data';

const BLOCKED_STATES: Record<
  Exclude<ChatStatusReason, 'ok'>,
  { icon: typeof Lock; heading: string; body: string }
> = {
  feature_disabled: {
    icon: MessageSquareOff,
    heading: 'Copilot is not enabled',
    body: 'This feature is not switched on for your organization yet. An admin can enable it under Settings → Copilot.',
  },
  // No longer returned by current backends (the admin's Copilot toggle IS the
  // org's AI consent) — kept so older backends still render something sensible.
  llm_consent_required: {
    icon: Lock,
    heading: 'AI features need approval',
    body: 'Your organization has not yet approved the use of AI features. An admin can enable Copilot under Settings → Copilot.',
  },
  no_warehouse: {
    icon: Database,
    heading: 'Connect a warehouse first',
    body: 'Copilot answers questions from your data warehouse. Set up your warehouse before using chat.',
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

const CHAT_PATH = '/chat-with-data';
/** Query param holding the open thread, so a reload or shared link lands in it */
const SESSION_PARAM = 'session';

function parseSessionId(value: string | null): number | null {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// useSearchParams needs a Suspense boundary in a client page
export default function ChatWithDataPage() {
  return (
    <Suspense fallback={null}>
      <ChatWithDataContent />
    </Suspense>
  );
}

function ChatWithDataContent() {
  const { status, isLoading: statusLoading, isError: statusError } = useChatWithDataStatus();
  const { sessions, isLoading: sessionsLoading, mutate: refreshSessions } = useChatSessions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeSessionId = parseSessionId(searchParams.get(SESSION_PARAM));
  const setActiveSessionId = useCallback(
    (sessionId: number | null) => {
      const href = sessionId ? `${CHAT_PATH}?${SESSION_PARAM}=${sessionId}` : CHAT_PATH;
      router.replace(href, { scroll: false });
    },
    [router]
  );

  // A thread id from the URL that isn't one of the user's (deleted, or another
  // org's link) falls back to a new chat. Checked once, on the first session
  // list — a thread created later is not in that list yet.
  const urlCheckedRef = useRef(false);
  useEffect(() => {
    if (urlCheckedRef.current || sessionsLoading) return;
    urlCheckedRef.current = true;
    if (activeSessionId && !sessions.some((session) => session.id === activeSessionId)) {
      setActiveSessionId(null);
    }
  }, [sessionsLoading, sessions, activeSessionId, setActiveSessionId]);
  const [dockOpen, setDockOpen] = useState(true);
  // question typed before any session existed; sent once the new session's socket is up
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  // model pick applies per turn; null until the user touches the selector
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const activeModel = selectedModel ?? status?.default_model ?? undefined;

  const { messages: history } = useChatSessionMessages(activeSessionId);
  const initialMessages = useMemo(() => historyToChatMessages(history), [history]);

  const onTitleUpdated = useCallback(() => {
    refreshSessions();
  }, [refreshSessions]);

  const { messages, sendMessage, respondToApproval, isStreaming } = useChatWithData(
    activeSessionId,
    {
      enabled: Boolean(status?.enabled),
      initialMessages,
      onTitleUpdated,
    }
  );

  useEffect(() => {
    if (pendingQuestion && activeSessionId) {
      sendMessage(pendingQuestion, activeModel);
      setPendingQuestion(null);
    }
  }, [pendingQuestion, activeSessionId, sendMessage, activeModel]);

  // Back to the hero empty state; the session itself is created on first send
  const handleNewChat = () => {
    setActiveSessionId(null);
  };

  const handleSend = async (question: string) => {
    trackEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT);
    if (activeSessionId) {
      sendMessage(question, activeModel);
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
        <Skeleton className="h-full flex-1" />
        <Skeleton className="h-full w-56" />
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
    <div className="flex h-full bg-[#F8FAFB]">
      {dockOpen && (
        <div className="hidden h-full md:flex">
          <ConversationDock
            sessions={sessions}
            activeSessionId={activeSessionId}
            onSelect={setActiveSessionId}
            onNewChat={handleNewChat}
            onRename={handleRename}
            onDelete={handleDelete}
          />
        </div>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeadbar dockOpen={dockOpen} onToggleDock={() => setDockOpen((open) => !open)} />
        <ChatPane
          messages={messages}
          isStreaming={isStreaming}
          onSend={handleSend}
          onApprovalRespond={respondToApproval}
          models={status.models ?? []}
          selectedModel={activeModel}
          onModelChange={setSelectedModel}
        />
      </div>
    </div>
  );
}
