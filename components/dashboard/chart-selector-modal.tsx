'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { useCharts } from '@/hooks/api/useCharts';
import { useKPIs } from '@/hooks/api/useKPIs';
import { StaticChartPreview } from '@/components/charts/StaticChartPreview';
import { Loader2, Search, Plus, Target } from 'lucide-react';
import { RAG_COLORS, METRIC_TYPE_TAG_OPTIONS } from '@/types/kpis';
import Link from 'next/link';

interface ChartSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (chartId: number) => void;
  onSelectKPI?: (kpiId: number, kpiName: string) => void;
  excludedChartIds?: number[];
  excludedKPIIds?: number[];
}

export function ChartSelectorModal({
  open,
  onClose,
  onSelect,
  onSelectKPI,
  excludedChartIds = [],
  excludedKPIIds = [],
}: ChartSelectorModalProps) {
  const [activeTab, setActiveTab] = useState('charts');
  const [chartSearch, setChartSearch] = useState('');
  const [kpiSearch, setKpiSearch] = useState('');

  const { data: charts, isLoading: chartsLoading } = useCharts({ search: chartSearch });
  const { data: kpis, isLoading: kpisLoading } = useKPIs({ search: kpiSearch || undefined });

  const handleSelectChart = (chartId: number) => {
    if (excludedChartIds.includes(chartId)) return;
    onSelect(chartId);
    onClose();
    setChartSearch('');
  };

  const handleSelectKPI = (kpiId: number, kpiName: string) => {
    if (excludedKPIIds.includes(kpiId)) return;
    onSelectKPI?.(kpiId, kpiName);
    onClose();
    setKpiSearch('');
  };

  const handleClose = () => {
    onClose();
    setChartSearch('');
    setKpiSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add Component</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="charts">Charts</TabsTrigger>
            <TabsTrigger value="kpis">KPIs</TabsTrigger>
          </TabsList>

          {/* Charts Tab */}
          <TabsContent value="charts" className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search charts..."
                  value={chartSearch}
                  onChange={(e) => setChartSearch(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <Link href="/charts/new?from=dashboard">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
                >
                  <Plus className="w-4 h-4" />
                  CREATE NEW CHART
                </Button>
              </Link>
            </div>

            <ScrollArea className="h-[600px] pr-4">
              {chartsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading charts...</span>
                </div>
              ) : charts && charts.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {charts.map((chart) => {
                    const isAlreadyAdded = excludedChartIds.includes(chart.id);
                    return (
                      <div
                        key={chart.id}
                        className={`border rounded-lg p-4 transition-all duration-200 ${
                          isAlreadyAdded
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                            : 'cursor-pointer hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectChart(chart.id)}
                      >
                        <div className="h-36 mb-3">
                          <StaticChartPreview chartType={chart.chart_type} />
                        </div>
                        <div className="text-center">
                          <h4 className="text-sm font-medium truncate mb-1">{chart.title}</h4>
                          <p className="text-xs text-gray-500 capitalize">{chart.chart_type}</p>
                          {isAlreadyAdded && (
                            <p className="text-xs text-orange-600 font-medium mt-1">
                              Already added
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">
                    {chartSearch
                      ? 'No charts found matching your search.'
                      : 'No charts available yet.'}
                  </div>
                  {!chartSearch && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400">
                        Get started by creating your first chart
                      </p>
                      <Link href="/charts/new?from=dashboard">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          CREATE YOUR FIRST CHART
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* KPIs Tab */}
          <TabsContent value="kpis" className="space-y-4">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search KPIs..."
                  value={kpiSearch}
                  onChange={(e) => setKpiSearch(e.target.value)}
                  className="w-full pl-10"
                />
              </div>
              <Link href="/kpis">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 whitespace-nowrap border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
                >
                  <Plus className="w-4 h-4" />
                  CREATE NEW KPI
                </Button>
              </Link>
            </div>

            <ScrollArea className="h-[600px] pr-4">
              {kpisLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">Loading KPIs...</span>
                </div>
              ) : kpis && kpis.length > 0 ? (
                <div className="grid grid-cols-3 gap-4">
                  {kpis.map((kpi) => {
                    const isAlreadyAdded = excludedKPIIds.includes(kpi.id);
                    const metricTypeLabel = METRIC_TYPE_TAG_OPTIONS.find(
                      (o) => o.value === kpi.metric_type_tag
                    )?.label;

                    return (
                      <div
                        key={kpi.id}
                        className={`border rounded-lg p-4 transition-all duration-200 ${
                          isAlreadyAdded
                            ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                            : 'cursor-pointer hover:bg-gray-50 hover:border-gray-300'
                        }`}
                        onClick={() => handleSelectKPI(kpi.id, kpi.name)}
                      >
                        <div className="h-36 flex flex-col items-center justify-center">
                          <Target className="h-10 w-10 text-gray-400 mb-3" />
                          <h4 className="text-sm font-medium truncate mb-1 max-w-full px-2">
                            {kpi.name}
                          </h4>
                          <p className="text-xs text-gray-500 truncate max-w-full px-2">
                            {kpi.metric.name}
                          </p>
                        </div>
                        <div className="text-center">
                          {metricTypeLabel && (
                            <Badge className="text-[10px] bg-violet-100 text-violet-700 border-0 hover:bg-violet-100 px-1 py-0">
                              {metricTypeLabel}
                            </Badge>
                          )}
                          {isAlreadyAdded && (
                            <p className="text-xs text-orange-600 font-medium mt-1">
                              Already added
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-gray-500 mb-4">
                    {kpiSearch ? 'No KPIs found matching your search.' : 'No KPIs available yet.'}
                  </div>
                  {!kpiSearch && (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-400">Create KPIs from your metrics first</p>
                      <Link href="/kpis">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all font-medium uppercase"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          GO TO KPIs
                        </Button>
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
