'use client';

import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ModelOption } from '@/types/chat-with-data';

interface ChatComposerProps {
  draft: string;
  onDraftChange: (draft: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder?: string;
  /** "hero" wraps the box in the gradient border + glow of the empty state */
  variant?: 'hero' | 'docked';
  models?: ModelOption[];
  selectedModel?: string;
  onModelChange?: (modelId: string) => void;
}

/**
 * The one composer box, in both design states: the glowing hero composer of
 * the empty state and the compact docked composer under a conversation.
 */
export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  disabled,
  placeholder = 'Ask about your program data. Avoid writing PII info...',
  variant = 'docked',
  models = [],
  selectedModel,
  onModelChange,
}: ChatComposerProps) {
  const canSend = !disabled && Boolean(draft.trim());
  const isHero = variant === 'hero';

  const box = (
    <div
      className={cn(
        'relative flex flex-col bg-white',
        isHero ? 'min-h-[48px] rounded-[13px]' : 'min-h-0 rounded-xl'
      )}
    >
      <Textarea
        id="chat-composer-input"
        data-testid="chat-composer-input"
        value={draft}
        placeholder={placeholder}
        rows={1}
        className={cn(
          'min-h-0 resize-none border-0 bg-transparent text-[15px] shadow-none',
          'placeholder:text-[#B0B0BE] focus-visible:ring-0',
          isHero ? 'max-h-48 px-3.5 pt-2.5' : 'max-h-32 px-3 py-1.5'
        )}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      <div
        className={cn('flex items-center justify-between gap-2 px-3', isHero ? 'pb-2' : 'pb-1.5')}
      >
        {models.length > 1 ? (
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger
              data-testid="chat-model-select"
              aria-label="AI model"
              className="h-6 w-auto gap-1 border-none bg-transparent px-1 text-[12px] text-muted-foreground shadow-none outline-none ring-0 hover:text-foreground focus:ring-0 focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
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
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={!canSend}
          data-testid="chat-composer-send"
          aria-label="Send"
          className={cn(
            'flex shrink-0 items-center justify-center rounded-[7px] text-white transition-colors',
            isHero ? 'size-7' : 'size-6',
            canSend ? 'bg-primary hover:bg-primary/90' : 'bg-[#A8C4C1]'
          )}
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );

  if (isHero) {
    return (
      <div className="relative w-full max-w-[724px]">
        <div
          aria-hidden="true"
          className="absolute -bottom-2 left-1/2 h-10 w-[95%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[rgba(180,219,255,0.55)] via-[rgba(118,204,215,0.55)] to-[rgba(105,230,216,0.55)] blur-xl"
        />
        <div className="relative rounded-[14px] bg-gradient-to-r from-[rgba(180,219,255,0.72)] via-[rgba(118,204,215,0.72)] to-[rgba(105,230,216,0.72)] p-[2px]">
          {box}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[724px]">
      <div className="rounded-xl border border-[#E8ECEF]">{box}</div>
    </div>
  );
}
