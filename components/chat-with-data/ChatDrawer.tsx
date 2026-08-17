'use client';

/**
 * Dashboard-scoped chat drawer. Opens from a dashboard page; the session it
 * creates is scoped server-side to the tables behind that dashboard's charts,
 * so answers can only come from the data the user is already looking at.
 */

import { useEffect, useRef, useState } from 'react';

import { ChatPane } from '@/components/chat-with-data/ChatPane';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createChatSession } from '@/hooks/api/useChatSessions';
import { useChatWithData } from '@/hooks/useChatWithData';
import { trackEvent } from '@/lib/analytics';
import { toastError } from '@/lib/toast';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface ChatDrawerProps {
  dashboardId: number;
  dashboardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatDrawer({ dashboardId, dashboardTitle, open, onOpenChange }: ChatDrawerProps) {
  // one session per page visit: created on first open, reused after reopening
  const [sessionId, setSessionId] = useState<number | null>(null);
  const creatingRef = useRef(false);

  useEffect(() => {
    if (!open || sessionId !== null || creatingRef.current) return;
    creatingRef.current = true;
    createChatSession({ scope_type: 'dashboard', scope_id: dashboardId })
      .then((session) => {
        setSessionId(session.id);
        trackEvent(ANALYTICS_EVENTS.CHAT_DASHBOARD_DRAWER_OPENED);
      })
      .catch(() => {
        toastError.api('Could not start a chat for this dashboard');
        onOpenChange(false);
      })
      .finally(() => {
        creatingRef.current = false;
      });
  }, [open, sessionId, dashboardId, onOpenChange]);

  const { messages, isStreaming, sendMessage } = useChatWithData(sessionId, {
    enabled: open && sessionId !== null,
  });

  const handleSend = (question: string) => {
    trackEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT);
    sendMessage(question);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-xl"
        data-testid="chat-drawer"
      >
        <SheetHeader className="border-b px-4 py-3">
          <SheetTitle data-testid="chat-drawer-title">Ask about {dashboardTitle}</SheetTitle>
          <SheetDescription data-testid="chat-drawer-scope-hint">
            Answers come only from this dashboard&apos;s data
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1">
          {sessionId !== null && (
            <ChatPane messages={messages} isStreaming={isStreaming} onSend={handleSend} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
