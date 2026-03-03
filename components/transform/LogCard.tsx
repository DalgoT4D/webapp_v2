// components/transform/LogCard.tsx
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LogCardProps {
  logs: string[];
  expand: boolean;
  setExpand: (expand: boolean) => void;
  fetchMore?: boolean;
  fetchMoreLogs?: () => void;
}

export function LogCard({
  logs,
  expand,
  setExpand,
  fetchMore = false,
  fetchMoreLogs,
}: LogCardProps) {
  if (logs.length === 0) return null;

  return (
    <Card data-testid="log-card">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Task Logs</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {logs.length} log {logs.length === 1 ? 'entry' : 'entries'}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpand(!expand)}
            data-testid="toggle-logs-btn"
          >
            {expand ? (
              <>
                <ChevronUp className="h-4 w-4 mr-2" />
                Collapse
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Expand
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea
          className={cn('w-full rounded-md border bg-muted/50', expand ? 'h-[500px]' : 'h-[200px]')}
        >
          <div className="p-4 font-mono text-xs space-y-1">
            {logs.map((log, idx) => (
              <div key={idx} className="whitespace-pre-wrap break-words leading-relaxed">
                {log}
              </div>
            ))}
          </div>
        </ScrollArea>
        {fetchMore && (
          <Button
            variant="outline"
            size="sm"
            onClick={fetchMoreLogs}
            className="w-full"
            data-testid="fetch-more-logs-btn"
          >
            Load More Logs
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
