'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageBubble } from './MessageBubble';
import { ChatComposer } from './ChatComposer';
import { ChatEmptyState } from './EmptyState';
import type { ChatMessage, ModelOption } from '@/types/chat-with-data';

interface ChatPaneProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (question: string) => void;
  /** Approve/cancel a pending human-in-the-loop card */
  onApprovalRespond?: (approve: boolean, piiColumns: string[]) => void;
  /** PII columns ticked earlier in this session — pre-tick new approval cards */
  rememberedPiiColumns?: string[];
  /** Models the user may pick; the selector renders only when there are 2+ */
  models?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
}

/**
 * Conversation + composer. A fresh chat shows the hero empty state with the
 * glowing composer front and center; once messages exist the composer docks
 * to the bottom. Auto-scrolls as answers stream in.
 */
export function ChatPane({
  messages,
  isStreaming,
  onSend,
  onApprovalRespond,
  rememberedPiiColumns = [],
  models = [],
  selectedModel,
  onModelChange,
}: ChatPaneProps) {
  const [draft, setDraft] = useState('');
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = () => {
    const question = draft.trim();
    if (!question || isStreaming) return;
    onSend(question);
    setDraft('');
  };

  const composer = (
    <ChatComposer
      draft={draft}
      onDraftChange={setDraft}
      onSend={send}
      disabled={isStreaming}
      variant={messages.length === 0 ? 'hero' : 'docked'}
      models={models}
      selectedModel={selectedModel}
      onModelChange={onModelChange}
    />
  );

  if (messages.length === 0) {
    return (
      <div className="flex h-full min-w-0 flex-1 flex-col bg-[#F8FAFB]">
        <ChatEmptyState composer={composer} onSuggestion={setDraft} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-[#F8FAFB]">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-5">
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onApprovalRespond={onApprovalRespond}
              rememberedPiiColumns={rememberedPiiColumns}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-[#E8ECEF] bg-white px-4 py-3">
        <div className="mx-auto w-full max-w-[720px]">{composer}</div>
      </div>
    </div>
  );
}
