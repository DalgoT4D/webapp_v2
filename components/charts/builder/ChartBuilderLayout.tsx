'use client';

import type { ReactNode } from 'react';
import { BarChart3, Database } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';

/** BUILDER-DRIFT: the two pages' frames differ only in these class strings — kept verbatim. */
const LAYOUT_CLASSES: Record<ChartBuilderKind, Record<string, string>> = {
  create: {
    root: 'min-h-screen bg-gray-50',
    header: 'bg-white border-b px-6 py-4',
    stylingContent: 'h-[calc(100%-73px)] overflow-y-auto',
    chartContent: 'h-[calc(100%-73px)] overflow-y-auto',
    chartInner: 'p-4 h-full',
    dataContent: 'h-[calc(100%-73px)] overflow-y-auto',
    dataInner: 'p-4',
  },
  edit: {
    root: 'h-full flex flex-col overflow-hidden bg-gray-50',
    header: 'bg-white border-b px-6 py-4 flex-shrink-0',
    stylingContent: 'mt-0 flex-1 overflow-y-auto',
    chartContent: 'h-[calc(100%-73px)] overflow-y-auto relative',
    chartInner: 'p-4 h-full relative',
    dataContent: 'h-[calc(100%-73px)] overflow-hidden',
    dataInner: 'p-4 h-full',
  },
};

interface ChartBuilderLayoutProps {
  builder: ChartBuilderKind;
  header: ReactNode;
  /** Controlled config tab (create, driven by the walkthrough); edit leaves it uncontrolled. */
  configTabValue?: string;
  onConfigTabChange: (value: string) => void;
  dataConfigPanel: ReactNode;
  stylingPanel: ReactNode;
  previewTab: string;
  onPreviewTabChange: (value: string) => void;
  /** Edit page's "configuration incomplete" overlay, drawn over the chart. */
  chartOverlay?: ReactNode;
  chartPanel: ReactNode;
  dataPanel: ReactNode;
  dialogs: ReactNode;
}

/** Frame shared by the create and edit chart builders: header, config tabs, CHART/DATA preview. */
export function ChartBuilderLayout(props: ChartBuilderLayoutProps) {
  const css = LAYOUT_CLASSES[props.builder];
  const configTabState =
    props.configTabValue !== undefined
      ? { value: props.configTabValue }
      : { defaultValue: 'configuration' };

  return (
    <div className={css.root}>
      {/* Single Header with Everything */}
      <div className={css.header}>{props.header}</div>

      {/* Main Content Area with 2rem margin container */}
      <div className="p-8 h-[calc(100vh-144px)]">
        <div className="flex h-full bg-white rounded-lg shadow-sm border overflow-hidden">
          {/* Left Panel - 30% */}
          <div className="w-[30%] border-r">
            <Tabs {...configTabState} onValueChange={props.onConfigTabChange} className="h-full">
              <div className="px-4 pt-4">
                <TabsList className="grid w-full h-11 grid-cols-2" data-testid="chart-config-tabs">
                  <TabsTrigger
                    value="configuration"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                    data-testid="chart-data-config-tab"
                  >
                    <BarChart3 className="h-4 w-4" />
                    Data Configuration
                  </TabsTrigger>
                  <TabsTrigger
                    value="styling"
                    className="flex items-center justify-center gap-2 text-sm h-full"
                    data-testid="chart-styling-tab"
                  >
                    <Database className="h-4 w-4" />
                    Chart Styling
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent
                value="configuration"
                className="mt-6 h-[calc(100%-73px)] overflow-y-auto"
              >
                <div className="p-4">{props.dataConfigPanel}</div>
              </TabsContent>

              <TabsContent value="styling" className={css.stylingContent}>
                <div className="p-4">{props.stylingPanel}</div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Right Panel - 70% */}
          <div className="w-[70%]">
            <Tabs
              value={props.previewTab}
              onValueChange={props.onPreviewTabChange}
              className="h-full"
            >
              <div className="px-4">
                <TabsList className="grid grid-cols-2">
                  <TabsTrigger
                    value="chart"
                    className="flex items-center gap-2"
                    data-testid="chart-preview-tab-chart"
                  >
                    <BarChart3 className="h-4 w-4" />
                    CHART
                  </TabsTrigger>
                  <TabsTrigger
                    value="data"
                    className="flex items-center gap-2"
                    data-testid="chart-preview-tab-data"
                  >
                    <Database className="h-4 w-4" />
                    DATA
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="chart" className={css.chartContent}>
                <div className={css.chartInner}>
                  {props.chartOverlay}
                  {props.chartPanel}
                </div>
              </TabsContent>

              <TabsContent value="data" className={css.dataContent}>
                <div className={css.dataInner}>{props.dataPanel}</div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {props.dialogs}
    </div>
  );
}
