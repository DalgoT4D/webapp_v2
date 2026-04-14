'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { Suspense, useCallback } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { WarehouseDisplay } from '@/components/ingest/warehouse/warehouse-display';
import { SourceList } from '@/components/ingest/sources/SourceList';
import { ConnectionsList } from '@/components/connections/connections-list';

const DEFAULT_TAB = 'connections';
const TABS = ['connections', 'sources', 'warehouse'] as const;
type IngestTab = (typeof TABS)[number];

const TAB_TRIGGER_CLASS =
  'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary';

function IngestPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentTab = (searchParams.get('tab') as IngestTab) || DEFAULT_TAB;

  const handleTabChange = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('tab', value);
      router.push(`/ingest?${params.toString()}`);
    },
    [searchParams, router]
  );

  return (
    <Tabs
      value={currentTab}
      onValueChange={handleTabChange}
      className="h-full flex flex-col"
      data-testid="ingest-tabs"
    >
      {/* Fixed Header */}
      <div className="flex-shrink-0 border-b bg-background">
        <div className="flex items-center justify-between p-6 pb-0">
          <div>
            <h1 className="text-3xl font-bold">Ingest</h1>
            <p className="text-muted-foreground mt-1">
              Manage Your Data Sources, Connections And Warehouse
            </p>
          </div>
        </div>

        <div className="px-6 pt-4 pb-0">
          <TabsList className="bg-transparent p-0 h-auto gap-4">
            <TabsTrigger
              value="connections"
              className={TAB_TRIGGER_CLASS}
              data-testid="tab-connections"
            >
              Connections
            </TabsTrigger>
            <TabsTrigger value="sources" className={TAB_TRIGGER_CLASS} data-testid="tab-sources">
              Sources
            </TabsTrigger>
            <TabsTrigger
              value="warehouse"
              className={TAB_TRIGGER_CLASS}
              data-testid="tab-warehouse"
            >
              Your Warehouse
            </TabsTrigger>
          </TabsList>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TabsContent value="connections" className="h-full m-0 overflow-y-auto">
          <ConnectionsList />
        </TabsContent>

        <TabsContent value="sources" className="h-full m-0 overflow-y-auto">
          <SourceList />
        </TabsContent>

        <TabsContent value="warehouse" className="h-full m-0 overflow-y-auto">
          <WarehouseDisplay />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default function IngestPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <IngestPageContent />
    </Suspense>
  );
}
