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
import { Label } from '@/components/ui/label';
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

  const getStreamKey = useCallback(
    (s: ClearStreamData) => `${s.streamNamespace ?? ''}::${s.streamName}`,
    []
  );

  const toggleStream = useCallback(
    (key: string) => {
      setStreams((prev) =>
        prev.map((s) => (getStreamKey(s) === key ? { ...s, selected: !s.selected } : s))
      );
    },
    [getStreamKey]
  );

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
              <Label htmlFor="select-all-streams" className="text-sm font-medium cursor-pointer">
                Select All
              </Label>
              <Switch
                id="select-all-streams"
                checked={allSelected}
                onCheckedChange={toggleAll}
                data-testid="select-all-streams"
              />
            </div>

            {/* Stream list */}
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {streams.map((stream) => {
                const key = getStreamKey(stream);
                const switchId = `select-stream-${key}`;
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between py-2 px-1 rounded hover:bg-muted/50"
                  >
                    <Label htmlFor={switchId} className="flex flex-col cursor-pointer font-normal">
                      <span className="text-sm font-mono">{stream.streamName}</span>
                      {stream.streamNamespace && (
                        <span className="text-xs text-muted-foreground">
                          {stream.streamNamespace}
                        </span>
                      )}
                    </Label>
                    <Switch
                      id={switchId}
                      checked={stream.selected}
                      onCheckedChange={() => toggleStream(key)}
                      data-testid={`clear-stream-${key}`}
                    />
                  </div>
                );
              })}
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
