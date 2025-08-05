'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCharts } from '@/hooks/api/useCharts';
import { MiniChart } from '@/components/charts/MiniChart';
import { Loader2, Search } from 'lucide-react';

interface ChartSelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (chartId: number) => void;
}

export function ChartSelectorModal({ open, onClose, onSelect }: ChartSelectorModalProps) {
  const [search, setSearch] = useState('');
  const { data: charts, isLoading } = useCharts({ search });

  const handleSelect = (chartId: number) => {
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
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Select a Chart</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search charts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10"
            />
          </div>

          <ScrollArea className="h-[500px] pr-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
                <span className="ml-2">Loading charts...</span>
              </div>
            ) : charts && charts.length > 0 ? (
              <div className="grid grid-cols-2 gap-4">
                {charts.map((chart) => (
                  <div
                    key={chart.id}
                    className="border rounded-lg p-4 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-200"
                    onClick={() => handleSelect(chart.id)}
                  >
                    <h3 className="font-medium mb-2 text-sm">{chart.title}</h3>
                    <div className="h-32 mb-2">
                      <MiniChart chartId={chart.id} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-gray-500 capitalize">{chart.chart_type} Chart</p>
                        <p className="text-xs text-gray-500 capitalize">{chart.computation_type}</p>
                      </div>
                      <p className="text-xs text-gray-400 truncate">
                        {chart.schema_name}.{chart.table_name}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                {search ? 'No charts found matching your search.' : 'No charts available.'}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
