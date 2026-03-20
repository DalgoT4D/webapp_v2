'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Bot, Loader2, Send, Sparkles } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDashboardChat, type DashboardChatMessage } from '@/hooks/api/useDashboardChat';

interface DashboardChatProps {
  dashboardId: number;
  dashboardTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enabled: boolean;
}

function AssistantMeta({ message }: { message: DashboardChatMessage }) {
  const citations = message.payload?.citations || [];
  const relatedDashboards = message.payload?.related_dashboards || [];
  const warnings = message.payload?.warnings || [];
  const warningEntries = warnings.reduce<Array<{ warning: string; key: string }>>(
    (entries, warning) => {
      const duplicateCount = entries.filter((entry) => entry.warning === warning).length + 1;
      entries.push({ warning, key: `${warning}-${duplicateCount}` });
      return entries;
    },
    []
  );

  if (citations.length === 0 && relatedDashboards.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 space-y-3">
      {warnings.length > 0 ? (
        <div className="space-y-2">
          {warningEntries.map(({ warning, key }) => (
            <div
              key={key}
              className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900"
            >
              {warning}
            </div>
          ))}
        </div>
      ) : null}

      {citations.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Sources</p>
          <div className="space-y-2">
            {citations.map((citation) => (
              <div
                key={`${citation.source_type}-${citation.source_identifier}`}
                className="rounded-md border bg-slate-50 px-3 py-2"
              >
                <p className="text-xs font-medium text-slate-900">{citation.title}</p>
                <p className="mt-1 text-xs text-slate-600">{citation.snippet}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {relatedDashboards.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Related dashboards
          </p>
          <div className="space-y-2">
            {relatedDashboards.map((dashboard) => (
              <Link
                key={dashboard.dashboard_id}
                href={`/dashboards/${dashboard.dashboard_id}`}
                className="block rounded-md border bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100"
              >
                <p className="text-sm font-medium text-slate-900">{dashboard.title}</p>
                <p className="mt-1 text-xs text-slate-600">{dashboard.reason}</p>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardChat({
  dashboardId,
  dashboardTitle,
  open,
  onOpenChange,
  enabled,
}: DashboardChatProps) {
  const { messages, isConnected, isThinking, error, sendMessage } = useDashboardChat({
    dashboardId,
    enabled,
  });
  const [draftMessage, setDraftMessage] = useState('');

  const hasMessages = messages.length > 0;
  const canSend = useMemo(
    () => draftMessage.trim().length > 0 && isConnected && !isThinking,
    [draftMessage, isConnected, isThinking]
  );

  const handleSend = () => {
    if (!canSend) {
      return;
    }

    const didSend = sendMessage(draftMessage);
    if (didSend) {
      setDraftMessage('');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-blue-600" />
            Chat with Dashboards
          </SheetTitle>
          <SheetDescription>{dashboardTitle}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1 px-4">
          <div className="space-y-4 py-4">
            {!hasMessages ? (
              <div className="rounded-xl border border-dashed bg-slate-50 p-4 text-sm text-slate-600">
                <div className="mb-2 flex items-center gap-2 font-medium text-slate-900">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  Ask about this dashboard
                </div>
                <p>
                  Ask questions about the dashboard, the charts on it, or the underlying warehouse
                  data that powers it.
                </p>
              </div>
            ) : null}

            {messages.map((message) => (
              <div
                key={message.id}
                className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={
                    message.role === 'user'
                      ? 'max-w-[85%] rounded-2xl bg-slate-900 px-4 py-3 text-sm text-white'
                      : 'max-w-[90%] rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 shadow-sm'
                  }
                >
                  <p className="whitespace-pre-wrap leading-6">{message.content}</p>
                  {message.role === 'assistant' ? <AssistantMeta message={message} /> : null}
                </div>
              </div>
            ))}

            {isThinking ? (
              <div className="flex justify-start">
                <div className="inline-flex items-center gap-2 rounded-2xl border bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  thinking
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        </ScrollArea>

        <div className="border-t p-4">
          <div className="mb-3 flex items-center gap-2 text-xs text-slate-500">
            <Badge variant={isConnected ? 'default' : 'secondary'}>
              {isConnected ? 'Connected' : 'Connecting'}
            </Badge>
            <span>Answers are grounded in the latest scheduled dashboard context build.</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask a question about this dashboard..."
              disabled={!isConnected || isThinking}
            />
            <Button onClick={handleSend} disabled={!canSend}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
