'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useCharts } from '@/hooks/api/useCharts';
import { MiniChart } from '@/components/charts/MiniChart';
import { Loader2, Search, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface ChartSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (chartId: number) => void;
  excludedChartIds?: number[]; // Charts already added to the dashboard
}

export function ChartSelectorModal({
  open,
  onClose,
  onSelect,
  excludedChartIds = [],
}: ChartSelectorModalProps) {
  const [search, setSearch] = useState('');
  const { data: charts, isLoading } = useCharts({ search });

  const handleSelect = (chartId: number) => {
    // Prevent selection if chart is already added
    if (excludedChartIds.includes(chartId)) {
      // Could show a toast message here in the future
      return;
    }

    onSelect(chartId);
    onClose();
    setSearch(''); // Reset search on close
  };

  const handleClose = () => {
    onClose();
    setSearch(''); // Reset search on close
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Select a Chart</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search and Create New Button */}
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search charts..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10"
              />
            </div>
            <Link href="/charts/new">
              <Button
                variant="outline"
                className="flex items-center gap-2 whitespace-nowrap border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all"
              >
                <Plus className="w-4 h-4" />
                Create New Chart
              </Button>
            </Link>
          </div>

          <ScrollArea className="h-[600px] pr-4">
            {isLoading ? (
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
                      onClick={() => handleSelect(chart.id)}
                    >
                      <div className="h-36 mb-3">
                        <MiniChart chartId={chart.id} showTitle={false} />
                      </div>
                      <div className="text-center">
                        <h4 className="text-sm font-medium truncate mb-1">{chart.title}</h4>
                        <p className="text-xs text-gray-500 capitalize">{chart.chart_type}</p>
                        {isAlreadyAdded && (
                          <p className="text-xs text-orange-600 font-medium mt-1">Already added</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-gray-500 mb-4">
                  {search ? 'No charts found matching your search.' : 'No charts available yet.'}
                </div>
                {!search && (
                  <div className="space-y-3">
                    <p className="text-sm text-gray-400">
                      Get started by creating your first chart
                    </p>
                    <Link href="/charts/new">
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-dashed border-2 hover:border-solid hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Your First Chart
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
