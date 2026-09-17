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
        'relative flex flex-col rounded-xl bg-white',
        isHero ? 'min-h-[120px]' : 'min-h-[76px] border border-[#E8ECEF]'
      )}
    >
      <Textarea
        id="chat-composer-input"
        data-testid="chat-composer-input"
        value={draft}
        placeholder="Ask about your program data…"
        rows={isHero ? 2 : 1}
        className={cn(
          'flex-1 resize-none border-0 bg-transparent px-3.5 pt-3 text-[15px] shadow-none',
          'placeholder:text-[#B0B0BE] focus-visible:ring-0',
          isHero ? 'max-h-48' : 'max-h-32'
        )}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
      />
      <div className="flex items-end justify-between gap-2 px-3 pb-2.5">
        {models.length > 1 ? (
          <Select value={selectedModel} onValueChange={onModelChange}>
            <SelectTrigger
              data-testid="chat-model-select"
              aria-label="AI model"
              className="h-7 w-auto gap-1 border-none px-1 text-[13px] font-medium text-[#5C5C6D] shadow-none hover:text-foreground"
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
            'flex shrink-0 items-center justify-center rounded-[9px] text-white transition-colors',
            isHero ? 'size-7 rounded-[7px]' : 'size-[34px]',
            canSend ? 'bg-primary hover:bg-primary/90' : 'bg-[#A8C4C1]'
          )}
        >
          <Send className={isHero ? 'size-3.5' : 'size-4'} />
        </button>
      </div>
    </div>
  );

  const piiNotice = (
    <p className="mt-2 text-xs text-[#7A7A8C]" data-testid="chat-pii-notice">
      Don&apos;t enter PII data here — your message goes directly to the AI model.
    </p>
  );

  if (!isHero) {
    return (
      <div>
        {box}
        {piiNotice}
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-[724px]">
      {/* soft glow that sits under the hero composer (Figma "gradient" ellipse) */}
      <div
        aria-hidden="true"
        className="absolute -bottom-2 left-1/2 h-10 w-[95%] -translate-x-1/2 rounded-full bg-gradient-to-r from-[rgba(180,219,255,0.55)] via-[rgba(118,204,215,0.55)] to-[rgba(105,230,216,0.55)] blur-xl"
      />
      <div className="relative rounded-[14px] bg-gradient-to-r from-[rgba(180,219,255,0.72)] via-[rgba(118,204,215,0.72)] to-[rgba(105,230,216,0.72)] p-[2px]">
        {box}
      </div>
      {piiNotice}
    </div>
  );
}
