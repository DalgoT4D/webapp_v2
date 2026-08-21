'use client';

import { useEffect, useRef, useState } from 'react';
import { SendHorizonal, MessageSquareText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageBubble } from './MessageBubble';
import type { ChatMessage, ModelOption } from '@/types/chat-with-data';

interface ChatPaneProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  onSend: (question: string) => void;
  /** Models the user may pick; the selector renders only when there are 2+ */
  models?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
}

/** Conversation + composer. Auto-scrolls as answers stream in. */
export function ChatPane({
  messages,
  isStreaming,
  onSend,
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
        {models.length > 1 && (
          <div className="mt-2 flex justify-end">
            <Select value={selectedModel} onValueChange={onModelChange}>
              <SelectTrigger
                data-testid="chat-model-select"
                aria-label="AI model"
                className="h-7 w-auto gap-1 border-none px-2 text-xs text-muted-foreground shadow-none"
              >
                <SelectValue placeholder="Model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model.id} value={model.id} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    </div>
  );
}
