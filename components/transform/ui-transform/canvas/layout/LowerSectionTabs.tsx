// components/transform/canvas/layout/LowerSectionTabs.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LogsPane } from '@/components/explore/LogsPane';
import { PreviewPane } from '@/components/explore/PreviewPane';
import { StatisticsPane } from '@/components/explore/StatisticsPane';
import { useTransformStore } from '@/stores/transformStore';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import type { TaskProgressLog, PreviewTableData } from '@/types/transform';

type LowerTab = 'preview' | 'logs' | 'data statistics';

// Tab bar height in px
const TAB_BAR_HEIGHT = 40;

export interface LowerSectionTabsProps {
  height: number;
  isFullScreen: boolean;
  isMinimized: boolean;
  onToggleFullScreen: () => void;
  onToggleMinimize: () => void;
  dbtRunLogs: TaskProgressLog[];
  isLogsLoading: boolean;
  previewTable: PreviewTableData | null;
}

export function LowerSectionTabs({
  height,
  isFullScreen,
  isMinimized,
  onToggleFullScreen,
  onToggleMinimize,
  dbtRunLogs,
  isLogsLoading,
  previewTable,
}: LowerSectionTabsProps) {
  const selectedTab = useTransformStore((s) => s.selectedLowerTab) as LowerTab;
  const setSelectedTab = useTransformStore((s) => s.setSelectedLowerTab);
  const { isFeatureFlagEnabled } = useFeatureFlags();

  const TABS = useMemo(() => {
    const tabs: { key: LowerTab; label: string }[] = [
      { key: 'preview', label: 'PREVIEW' },
      { key: 'logs', label: 'LOGS' },
    ];
    if (isFeatureFlagEnabled(FeatureFlagKeys.DATA_STATISTICS)) {
      tabs.push({ key: 'data statistics', label: 'DATA STATISTICS' });
    }
    return tabs;
  }, [isFeatureFlagEnabled]);

  // Auto-switch to preview tab when a table is selected
  useEffect(() => {
    if (previewTable) {
      setSelectedTab('preview');
    }
  }, [previewTable, setSelectedTab]);

  // Auto-switch to logs tab when a workflow starts
  useEffect(() => {
    if (isLogsLoading && dbtRunLogs.length === 0) {
      setSelectedTab('logs');
    }
  }, [isLogsLoading, dbtRunLogs.length, setSelectedTab]);

  const contentHeight = Math.max(80, height - TAB_BAR_HEIGHT);

  return (
    <div
      className="flex flex-col bg-white border-t"
      style={{ height }}
      data-testid="lower-section-tabs"
    >
      {/* Tab Bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b bg-gray-50/50"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        <div className="flex gap-4">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={cn(
                'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide cursor-pointer',
                'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent',
                selectedTab === tab.key
                  ? 'text-teal-600 after:bg-teal-600'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              data-testid={`${tab.key}-tab`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleMinimize}
            className="h-6 w-6"
            aria-label={isMinimized ? 'Expand panel' : 'Minimize panel'}
            data-testid="minimize-toggle"
          >
            {isMinimized ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleFullScreen}
            className="h-6 w-6"
            aria-label="Toggle fullscreen"
            data-testid="fullscreen-toggle"
          >
            {isFullScreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Tab content — hidden when minimized */}
      {!isMinimized && (
        <>
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

          {/* Data Statistics Tab */}
          {selectedTab === 'data statistics' &&
            (previewTable ? (
              <StatisticsPane
                key={`stats-${previewTable.schema}.${previewTable.table}`}
                schema={previewTable.schema}
                table={previewTable.table}
              />
            ) : (
              <div
                className="flex items-center justify-center text-muted-foreground"
                style={{ height: contentHeight }}
              >
                Select a node to view data statistics
              </div>
            ))}
        </>
      )}
    </div>
  );
}
