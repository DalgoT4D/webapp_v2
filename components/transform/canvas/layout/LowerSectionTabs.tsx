// components/transform/canvas/layout/LowerSectionTabs.tsx
'use client';

import { useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2, Minimize2 } from 'lucide-react';
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
      {/* Tab Bar */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 border-b bg-gray-50/50"
        style={{ height: TAB_BAR_HEIGHT }}
      >
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key)}
              className={cn(
                'px-3 py-1.5 text-xs font-semibold tracking-wide rounded transition-colors',
                selectedTab === tab.key
                  ? 'text-primary border-b-2 border-primary'
                  : 'text-gray-500 hover:text-gray-700'
              )}
              data-testid={`${tab.key}-tab`}
            >
              {tab.label}
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
    </div>
  );
}
