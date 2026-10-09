'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseDisplay } from '@/components/ingest/warehouse/warehouse-display';
import { DocsLink } from '@/components/ui/docs-link';
import ConnectionsTab from './ConnectionsTab';
import { trackFeatureView } from '@/lib/analytics';
import { FEATURES } from '@/constants/analytics';

const TAB_TRIGGER_CLASS =
  'relative bg-transparent border-0 shadow-none rounded-none px-1 py-2.5 text-sm font-medium uppercase tracking-wide text-gray-500 cursor-pointer data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-transparent data-[state=active]:after:bg-primary';

export default function DataSettings() {
  const [tab, setTab] = useState('warehouse');

  return (
    <div className="h-full flex flex-col min-h-0">
      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value);
          trackFeatureView(FEATURES.SETTINGS_DATA, { tab: value });
        }}
        className="w-full flex-1 flex flex-col min-h-0"
      >
        <div className="flex-shrink-0 border-b bg-background">
          <div className="p-6 pb-0">
            <DocsLink path="/settings/data">
              <h1 className="text-3xl font-bold">Data</h1>
            </DocsLink>
            <p className="text-muted-foreground mt-1">
              Warehouse configuration and connection behavior
            </p>
          </div>
          <div className="flex items-center gap-2 px-6 pt-4 pb-0">
            <TabsList className="bg-transparent p-0 h-auto gap-4">
              <TabsTrigger
                value="warehouse"
                className={TAB_TRIGGER_CLASS}
                data-testid="tab-warehouse"
              >
                Warehouse
              </TabsTrigger>
              <TabsTrigger
                value="connections"
                className={TAB_TRIGGER_CLASS}
                data-testid="tab-connections"
              >
                Connections
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <TabsContent value="warehouse" className="mt-0">
            <WarehouseDisplay />
          </TabsContent>
          <TabsContent value="connections" className="mt-0">
            <ConnectionsTab />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}
