'use client';

import { useState } from 'react';
import { MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ChatSession } from '@/types/chat-with-data';

interface ConversationDockProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelect: (sessionId: number) => void;
  onNewChat: () => void;
  onRename: (sessionId: number, title: string) => void;
  onDelete: (sessionId: number) => void;
}

/** History dock beside the app nav — new chat, select, rename inline, delete */
export function ConversationDock({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: ConversationDockProps) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const submitRename = (sessionId: number) => {
    const title = renameDraft.trim();
    if (title) onRename(sessionId, title);
    setRenamingId(null);
  };

  return (
    <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-[#E8ECEF] bg-[#F8FAFB]">
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-center gap-2 border-[#E2E8F0] bg-white text-sm font-medium text-[#0F172A]"
          variant="outline"
          data-testid="chat-new-session"
        >
          <Plus className="size-4" />
          New Chat
        </Button>
      </div>
      {sessions.length > 0 ? (
        <>
          <p className="px-4 pb-2 pt-1 text-[11px] font-semibold tracking-wide text-[#7A7A8C]">
            HISTORY
          </p>
          <nav className="flex-1 overflow-y-auto px-3 pb-3">
            {sessions.map((session) => (
              <div
                key={session.id}
                data-testid={`chat-session-${session.id}`}
                data-active={session.id === activeSessionId ? 'true' : 'false'}
                className={cn(
                  'group mb-0.5 flex h-9 items-center rounded-md text-sm text-[#5C5C6D]',
                  session.id === activeSessionId ? 'bg-[#E8ECEF]' : 'hover:bg-[#E8ECEF]/60'
                )}
              >
                {renamingId === session.id ? (
                  <Input
                    autoFocus
                    value={renameDraft}
                    data-testid={`chat-session-rename-input-${session.id}`}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    onBlur={() => submitRename(session.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitRename(session.id);
                      if (event.key === 'Escape') setRenamingId(null);
                    }}
                    className="m-1 h-7 bg-white text-sm"
                  />
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelect(session.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 py-2 pl-2 text-left"
                    >
                      <span
                        aria-hidden="true"
                        className="size-1 shrink-0 rounded-full bg-[#B0B0BE]"
                      />
                      <span className="truncate">{session.title}</span>
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="mr-1 h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                          data-testid={`chat-session-menu-${session.id}`}
                        >
                          <MoreVertical className="size-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem
                          data-testid={`chat-session-rename-${session.id}`}
                          onClick={() => {
                            setRenamingId(session.id);
                            setRenameDraft(session.title);
                          }}
                        >
                          <Pencil className="mr-2 size-4" />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          data-testid={`chat-session-delete-${session.id}`}
                          className="text-destructive"
                          onClick={() => onDelete(session.id)}
                        >
                          <Trash2 className="mr-2 size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            ))}
          </nav>
        </>
      ) : (
        <p className="px-4 py-2 text-[11px] font-semibold tracking-wide text-[#7A7A8C]">
          No chat history yet
        </p>
      )}
    </aside>
  );
}
