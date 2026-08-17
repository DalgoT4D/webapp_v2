'use client';

import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage } from '@/types/chat-with-data';

interface ChatPaneProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (question: string) => void;
}

/** Conversation + composer. Auto-scrolls as answers stream in. */
export function ChatPane({ messages, isStreaming, onSend }: ChatPaneProps) {
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

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div
            className="flex h-full flex-col items-center justify-center gap-2 text-center"
            data-testid="chat-empty-state"
          >
            <MessageSquareText className="h-10 w-10 text-muted-foreground/50" />
            <p className="font-medium">Ask a question about your data</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              For example: &ldquo;How many surveys did we complete last month?&rdquo; or
              &ldquo;Which district has the most participants?&rdquo;
            </p>
          </div>
        ) : (
          messages.map((message) => <MessageBubble key={message.id} message={message} />)
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3">
        <div className="flex items-end gap-2">
          <Textarea
            id="chat-composer-input"
            data-testid="chat-composer-input"
            value={draft}
            placeholder="Type a question about your data…"
            rows={1}
            className="max-h-32 min-h-[2.5rem] resize-none"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button
            size="icon"
            onClick={send}
            disabled={isStreaming || !draft.trim()}
            data-testid="chat-composer-send"
            aria-label="Send"
          >
            <SendHorizonal className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
