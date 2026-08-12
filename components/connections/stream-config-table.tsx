'use client';

import { ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { SourceStream } from '@/types/connections';

const TABLE_TOOLS_THRESHOLD = 5;

interface StreamConfigTableProps {
  streams: SourceStream[];
  filteredStreams: SourceStream[];
  allSelected: boolean;
  streamSearch: string;
  disabled: boolean;
  isSaving: boolean;
  activeStreamName: string | null;
  onStreamSearchChange: (value: string) => void;
  onToggleAllStreams: (selected: boolean) => void;
  onToggleStream: (streamName: string) => void;
  onOpenSettings: (streamName: string) => void;
  streamNoun?: string;
}

// Keeps the table-selection task simple. Per-table configuration lives in the
// adjacent StreamSettingsPanel instead of being compressed into this table.
export function StreamConfigTable({
  streams,
  filteredStreams,
  allSelected,
  streamSearch,
  disabled,
  isSaving,
  activeStreamName,
  onStreamSearchChange,
  onToggleAllStreams,
  onToggleStream,
  onOpenSettings,
  streamNoun = 'Tables',
}: StreamConfigTableProps) {
  const selectedCount = streams.filter((stream) => stream.selected).length;
  const showTableTools = streams.length > TABLE_TOOLS_THRESHOLD || streamSearch.length > 0;

  return (
    <section className="flex min-h-0 flex-1 flex-col" data-testid="stream-config-table">
      <h3 className="mb-3 text-base font-semibold">
        {`Select your ${streamNoun.toLowerCase()} (${selectedCount}/${streams.length} selected)`}
      </h3>

      {showTableTools && (
        <div className="mb-3 flex items-center gap-3">
          <Input
            placeholder={`Filter ${streamNoun.toLowerCase()}...`}
            value={streamSearch}
            onChange={(event) => onStreamSearchChange(event.target.value)}
            className="h-9 flex-1 text-sm"
            data-testid="stream-filter-input"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <label htmlFor="toggle-all-streams">Sync all</label>
            <Switch
              id="toggle-all-streams"
              checked={allSelected}
              onCheckedChange={(checked) => onToggleAllStreams(checked)}
              disabled={disabled || isSaving}
              data-testid="toggle-all-streams"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 overflow-y-auto rounded-lg border">
        <table className="w-full table-fixed text-sm" data-testid="streams-table">
          <colgroup>
            <col className="w-[50%]" />
            <col className="w-[18%]" />
            <col className="w-[32%]" />
          </colgroup>
          <thead className="sticky top-0 z-10 bg-background">
            <tr className="border-b text-muted-foreground">
              <th className="px-4 py-3 text-left text-sm font-medium">{streamNoun}</th>
              <th className="px-3 py-3 text-center text-sm font-medium">Sync</th>
              <th className="px-4 py-3 text-left text-sm font-medium">Advanced settings</th>
            </tr>
          </thead>
          <tbody>
            {filteredStreams.map((stream) => {
              const isActive = activeStreamName === stream.name;
              return (
                <tr
                  key={stream.name}
                  data-testid={`stream-row-${stream.name}`}
                  data-active={isActive}
                  className={cn(
                    'border-b last:border-b-0 transition-colors',
                    isActive
                      ? 'border-l-2 border-l-primary bg-primary/5'
                      : 'border-l-2 border-l-transparent'
                  )}
                >
                  <td className="px-4 py-4">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate text-sm font-medium text-foreground">
                            {stream.name}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-xs break-all">
                          <p className="text-xs">{stream.name}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </td>
                  <td className="px-3 py-4 text-center">
                    <Switch
                      id={`stream-toggle-${stream.name}`}
                      checked={stream.selected}
                      onCheckedChange={() => onToggleStream(stream.name)}
                      disabled={disabled || isSaving}
                      aria-label={`Sync ${stream.name}`}
                      data-testid={`stream-toggle-${stream.name}`}
                      className="scale-90"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => onOpenSettings(stream.name)}
                      aria-label={`Open advanced settings for ${stream.name}`}
                      aria-pressed={isActive}
                      data-testid={`open-stream-settings-${stream.name}`}
                      className={cn(
                        'inline-flex min-h-8 items-center gap-1 rounded-sm px-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        isActive ? 'text-primary' : 'text-foreground hover:text-primary'
                      )}
                    >
                      Open settings
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredStreams.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            No {streamNoun.toLowerCase()} match your search.
          </p>
        )}
      </div>
    </section>
  );
}
