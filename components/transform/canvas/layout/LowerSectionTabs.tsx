// components/transform/canvas/layout/LowerSectionTabs.tsx
'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogsPane } from '@/components/explore/LogsPane';
import { PreviewPane } from '@/components/explore/PreviewPane';
import type { TaskProgressLog, PreviewTableData } from '@/types/transform';

type LowerTab = 'preview' | 'logs';

// Tab bar height in px — keep compact
const TAB_BAR_HEIGHT = 36;

export interface LowerSectionTabsProps {
  height: number;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  dbtRunLogs: TaskProgressLog[];
  isLogsLoading: boolean;
  previewTable: PreviewTableData | null;
}

export function LowerSectionTabs({
  height,
  isFullScreen,
  onToggleFullScreen,
  dbtRunLogs,
  isLogsLoading,
  previewTable,
}: LowerSectionTabsProps) {
  const [selectedTab, setSelectedTab] = useState<LowerTab>('logs');

  // Auto-switch to preview tab when a table is selected
  useEffect(() => {
    if (previewTable) {
      setSelectedTab('preview');
    }
  }, [previewTable]);

  // Auto-switch to logs tab when a workflow starts
  useEffect(() => {
    if (isLogsLoading && dbtRunLogs.length === 0) {
      setSelectedTab('logs');
    }
  }, [isLogsLoading, dbtRunLogs.length]);

  const contentHeight = Math.max(80, height - TAB_BAR_HEIGHT);

  return (
    <div
      className="flex flex-col bg-white border-t"
      style={{ height }}
      data-testid="lower-section-tabs"
    >
      {/* Compact Tab Bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b bg-gray-50/50"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        <div className="flex gap-1">
          {(['preview', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab)}
              className={cn(
                'px-3 py-1 text-sm font-medium rounded transition-colors capitalize',
                selectedTab === tab
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              data-testid={`${tab}-tab`}
            >
              {tab}
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleFullScreen}
          className="h-6 w-6"
          data-testid="fullscreen-toggle"
        >
          {isFullScreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
        </Button>
      </div>

      {/* Preview Tab */}
      {selectedTab === 'preview' &&
        (previewTable ? (
          <PreviewPane
            key={`${previewTable.schema}.${previewTable.table}`}
            schema={previewTable.schema}
            table={previewTable.table}
            containerHeight={contentHeight}
          />
        ) : (
          <div
            className="flex items-center justify-center text-muted-foreground"
            style={{ height: contentHeight }}
          >
            Select a node to preview its data
          </div>
        ))}

      {/* Logs Tab */}
      {selectedTab === 'logs' && (
        <div style={{ height: contentHeight }}>
          <LogsPane height={contentHeight} dbtRunLogs={dbtRunLogs} isLoading={isLogsLoading} />
        </div>
      )}
    </div>
  );
}
