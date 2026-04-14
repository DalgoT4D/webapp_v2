'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useConnection } from '@/hooks/api/useConnections';
import type { ClearStreamData } from '@/types/connections';

interface StreamSelectionDialogProps {
  connectionId: string;
  onClose: () => void;
  onConfirm: (selectedStreams: ClearStreamData[]) => void;
}

export function StreamSelectionDialog({
  connectionId,
  onClose,
  onConfirm,
}: StreamSelectionDialogProps) {
  const { data: connection, isLoading } = useConnection(connectionId);

  const initialStreams = useMemo<ClearStreamData[]>(() => {
    if (!connection) return [];
    return connection.syncCatalog.streams
      .filter((s) => s.config.selected)
      .map((s) => ({
        streamName: s.stream.name,
        streamNamespace: s.stream.namespace,
        selected: false,
      }));
  }, [connection]);

  const [streams, setStreams] = useState<ClearStreamData[]>([]);

  // Initialize streams when data loads
  useEffect(() => {
    if (initialStreams.length > 0 && streams.length === 0) {
      setStreams(initialStreams);
    }
  }, [initialStreams, streams.length]);

  const toggleStream = useCallback((streamName: string) => {
    setStreams((prev) =>
      prev.map((s) => (s.streamName === streamName ? { ...s, selected: !s.selected } : s))
    );
  }, []);

  const toggleAll = useCallback((selected: boolean) => {
    setStreams((prev) => prev.map((s) => ({ ...s, selected })));
  }, []);

  const hasSelected = streams.some((s) => s.selected);
  const allSelected = streams.length > 0 && streams.every((s) => s.selected);

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[70vw] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Streams to Clear</DialogTitle>
          <DialogDescription>
            Choose which streams to clear. This will remove all synced data for the selected
            streams.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Select all toggle */}
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm font-medium">Select All</span>
              <Switch
                checked={allSelected}
                onCheckedChange={toggleAll}
                data-testid="select-all-streams"
              />
            </div>

            {/* Stream list */}
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {streams.map((stream) => (
                <div
                  key={stream.streamName}
                  className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50"
                  data-testid={`clear-stream-${stream.streamName}`}
                >
                  <span className="text-sm font-mono">{stream.streamName}</span>
                  <Switch
                    checked={stream.selected}
                    onCheckedChange={() => toggleStream(stream.streamName)}
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => onConfirm(streams)}
            disabled={!hasSelected}
            data-testid="confirm-clear-streams"
          >
            Clear Selected Streams
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
