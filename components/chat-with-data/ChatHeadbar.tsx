'use client';

import { PanelLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopilotIcon } from './CopilotIcon';

/** The slim bar above the conversation: history-dock toggle + Copilot identity */
export function ChatHeadbar({
  dockOpen,
  onToggleDock,
}: {
  dockOpen: boolean;
  onToggleDock: () => void;
}) {
  return (
    <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-[#E8ECEF] bg-white px-3.5">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground"
        onClick={onToggleDock}
        aria-label={dockOpen ? 'Hide chat history' : 'Show chat history'}
        data-testid="chat-dock-toggle"
      >
        <PanelLeft className="size-4" />
      </Button>
      <div className="flex items-center gap-1">
        <CopilotIcon className="size-4" />
        <span className="text-sm font-medium text-[#1A1A2E]">Copilot</span>
      </div>
    </div>
  );
}
