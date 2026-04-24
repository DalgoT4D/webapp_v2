// components/explore/Explore.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Resizable } from 'react-resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useExploreStore } from '@/stores/exploreStore';
import { useWarehouseTables, syncWarehouseTables } from '@/hooks/api/useWarehouse';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import { ProjectTree } from './ProjectTree';
import { PreviewPane } from './PreviewPane';
import { StatisticsPane } from './StatisticsPane';
import { toast } from 'sonner';
import { EXPLORE_DIMENSIONS, ExploreTab } from '@/constants/explore';
import { Database } from 'lucide-react';

import 'react-resizable/css/styles.css';

export function Explore() {
  const {
    selectedTable,
    setSelectedTable,
    activeTab,
    setActiveTab,
    sidebarWidth,
    setSidebarWidth,
    reset,
  } = useExploreStore();

  const searchParams = useSearchParams();
  const [isSyncing, setIsSyncing] = useState(false);
  const { data: tables, isLoading: tablesLoading, mutate: mutateTables } = useWarehouseTables();
  const { isFeatureFlagEnabled } = useFeatureFlags();

  const showStatisticsTab = isFeatureFlagEnabled(FeatureFlagKeys.DATA_STATISTICS);

  // Preselect table from URL params if provided
  useEffect(() => {
    const schemaName = searchParams.get('schema_name');
    const tableName = searchParams.get('table_name');
    if (schemaName && tableName) {
      setSelectedTable({ schema: schemaName, table: tableName });
      setActiveTab(ExploreTab.PREVIEW);
    }
  }, [searchParams, setSelectedTable, setActiveTab]);

  // Reset state on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);

  const handleTableSelect = useCallback(
    (schema: string, table: string) => {
      setSelectedTable({ schema, table });
      setActiveTab(ExploreTab.PREVIEW);
    },
    [setSelectedTable, setActiveTab]
  );

  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      const freshTables = await syncWarehouseTables();
      mutateTables(freshTables, false);
      toast.success('Tables synced with warehouse');
    } catch (error) {
      toast.error('Failed to sync tables');
      console.error('Sync error:', error);
    } finally {
      setIsSyncing(false);
    }
  }, [mutateTables]);

  const handleResize = useCallback(
    (_event: React.SyntheticEvent, { size }: { size: { width: number; height: number } }) => {
      setSidebarWidth(size.width);
    },
    [setSidebarWidth]
  );

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Page Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6 pb-6">
          <div>
            <h1 className="text-3xl font-bold" data-testid="explore-page-title">
              Explore
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="explore-page-subtitle">
              View your tables in the warehouse
            </p>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Resizable Sidebar */}
        <Resizable
          width={sidebarWidth}
          height={0}
          onResize={handleResize}
          minConstraints={[EXPLORE_DIMENSIONS.SIDEBAR_MIN_WIDTH, 0]}
          maxConstraints={[EXPLORE_DIMENSIONS.SIDEBAR_MAX_WIDTH, 0]}
          handle={
            <div className="absolute right-0 top-0 h-full w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors" />
          }
          axis="x"
        >
          <div className="relative h-full border-r bg-white" style={{ width: sidebarWidth }}>
            <ProjectTree
              tables={tables ?? []}
              loading={tablesLoading || isSyncing}
              onSync={handleSync}
              onTableSelect={handleTableSelect}
              selectedTable={selectedTable}
            />
          </div>
        </Resizable>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {selectedTable ? (
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as ExploreTab)}
              className="flex flex-col h-full"
            >
              <div className="flex-shrink-0 border-y px-6" style={{ background: '#F5FAFA' }}>
                <TabsList className="bg-transparent p-0 h-auto gap-4">
                  <TabsTrigger
                    value={ExploreTab.PREVIEW}
                    data-testid="preview-tab"
                    className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
                  >
                    Preview
                  </TabsTrigger>
                  {showStatisticsTab && (
                    <TabsTrigger
                      value={ExploreTab.STATISTICS}
                      data-testid="statistics-tab"
                      className="relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-teal-600 data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-teal-600"
                    >
                      Data statistics
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <TabsContent value={ExploreTab.PREVIEW} className="flex-1 overflow-hidden m-0">
                <PreviewPane
                  schema={selectedTable.schema}
                  table={selectedTable.table}
                  defaultPageSize={25}
                />
              </TabsContent>

              {showStatisticsTab && (
                <TabsContent value={ExploreTab.STATISTICS} className="flex-1 overflow-hidden m-0">
                  <StatisticsPane schema={selectedTable.schema} table={selectedTable.table} />
                </TabsContent>
              )}
            </Tabs>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-4">
              <Database className="h-12 w-12 text-gray-300" />
              <p className="text-base">Select a table from the sidebar to view its data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
