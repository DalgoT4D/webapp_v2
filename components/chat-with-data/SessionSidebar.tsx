'use client';

import { useState } from 'react';
import { MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
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

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: number | null;
  onSelect: (sessionId: number) => void;
  onNewChat: () => void;
  onRename: (sessionId: number, title: string) => void;
  onDelete: (sessionId: number) => void;
}

/** Session list — select, create, rename inline, delete */
export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelect,
  onNewChat,
  onRename,
  onDelete,
}: SessionSidebarProps) {
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState('');

  const submitRename = (sessionId: number) => {
    const title = renameDraft.trim();
    if (title) onRename(sessionId, title);
    setRenamingId(null);
  };

  return (
    <div className="flex h-full w-64 flex-col border-r">
      <div className="p-3">
        <Button
          onClick={onNewChat}
          className="w-full justify-start gap-2"
          variant="outline"
          data-testid="chat-new-session"
        >
          <Plus className="h-4 w-4" />
          New chat
        </Button>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            data-testid={`chat-session-${session.id}`}
            data-active={session.id === activeSessionId ? 'true' : 'false'}
            className={cn(
              'group mb-0.5 flex items-center rounded-md text-sm',
              session.id === activeSessionId ? 'bg-accent font-medium' : 'hover:bg-accent/50'
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
                className="m-1 h-7 text-sm"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelect(session.id)}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-left"
                >
                  {session.title}
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="mr-1 h-7 w-7 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
                      data-testid={`chat-session-menu-${session.id}`}
                    >
                      <MoreHorizontal className="h-4 w-4" />
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
                      <Pencil className="mr-2 h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid={`chat-session-delete-${session.id}`}
                      className="text-destructive"
                      onClick={() => onDelete(session.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
        {sessions.length === 0 && (
          <p className="px-3 py-2 text-sm text-muted-foreground">No chats yet</p>
        )}
      </nav>
    </div>
  );
}
