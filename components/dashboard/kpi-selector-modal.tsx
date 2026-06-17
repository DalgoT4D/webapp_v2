'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useKPIs } from '@/hooks/api/useKPIs';
import { OverflowTooltip } from '@/components/ui/overflow-tooltip';
import { Loader2, Search, Plus } from 'lucide-react';
import Link from 'next/link';

interface KPISelectorModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (kpiId: number, kpiName: string) => void;
  excludedKPIIds?: number[];
}

export function KPISelectorModal({
  open,
  onClose,
  onSelect,
  excludedKPIIds = [],
}: KPISelectorModalProps) {
  const [search, setSearch] = useState('');

  const { data: kpis, isLoading } = useKPIs({ search: search || undefined });

  const handleSelect = (kpiId: number, kpiName: string) => {
    if (excludedKPIIds.includes(kpiId)) return;
    onSelect(kpiId, kpiName);
    onClose();
    setSearch('');
  };

  const handleClose = () => {
    onClose();
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Add KPI</DialogTitle>
        </DialogHeader>

        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search KPIs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="ml-2">Loading KPIs...</span>
            </div>
          ) : kpis && kpis.length > 0 ? (
            <div className="grid grid-cols-3 gap-4">
              {kpis.map((kpi) => {
                const isAlreadyAdded = excludedKPIIds.includes(kpi.id);

                return (
                  <div
                    key={kpi.id}
                    className={`border rounded-lg p-4 transition-all duration-200 ${
                      isAlreadyAdded
                        ? 'opacity-50 cursor-not-allowed bg-gray-100 border-gray-200'
                        : 'cursor-pointer hover:bg-gray-50 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelect(kpi.id, kpi.name)}
                  >
                    <div
                      className="h-36 mb-3 flex items-center justify-center p-4 rounded-lg"
                      style={{ backgroundColor: '#3B82F61A' }}
                    >
                      <svg viewBox="0 0 100 60" className="w-full h-full">
                        <polyline
                          points="10,45 25,35 40,20 55,25 70,15 85,10"
                          fill="none"
                          stroke="#3B82F6"
                          strokeWidth="2"
                          className="drop-shadow-sm"
                        />
                        <circle cx="10" cy="45" r="2" fill="#3B82F6" />
                        <circle cx="25" cy="35" r="2" fill="#3B82F6" />
                        <circle cx="40" cy="20" r="2" fill="#3B82F6" />
                        <circle cx="55" cy="25" r="2" fill="#3B82F6" />
                        <circle cx="70" cy="15" r="2" fill="#3B82F6" />
                        <circle cx="85" cy="10" r="2" fill="#3B82F6" />
                      </svg>
                    </div>
                    <div className="text-center">
                      <OverflowTooltip
                        text={kpi.name}
                        className="text-sm font-medium mb-1"
                        tooltipAlign="center"
                      />
                      <OverflowTooltip
                        text={kpi.metric.name}
                        className="text-xs text-gray-500"
                        tooltipAlign="center"
                      />
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
                {search ? 'No KPIs found matching your search.' : 'No KPIs available yet.'}
              </div>
              {!search && (
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
      </DialogContent>
    </Dialog>
  );
}
