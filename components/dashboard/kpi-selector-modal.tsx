'use client';

import React, { useMemo, useState } from 'react';
import { Search, Target } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useKPIs } from '@/hooks/api/useKPIs';

interface KPISelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (kpiId: number) => void;
}

export function KPISelectorModal({ open, onOpenChange, onSelect }: KPISelectorModalProps) {
  const { data: kpis, isLoading } = useKPIs();
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!kpis) return [];
    if (!search) return kpis;
    const q = search.toLowerCase();
    return kpis.filter(
      (k) =>
        k.metric.name.toLowerCase().includes(q) ||
        k.program_tag.toLowerCase().includes(q) ||
        k.metric_type_tag.toLowerCase().includes(q)
    );
  }, [kpis, search]);

  const handlePick = (kpiId: number) => {
    onSelect(kpiId);
    onOpenChange(false);
    setSearch('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5">
          <DialogTitle className="text-2xl font-semibold tracking-tight">Add a KPI</DialogTitle>
          <DialogDescription>
            Pick from your KPIs library. The widget updates live when the underlying KPI or its data
            changes.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pt-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search KPIs…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="grid gap-2 px-6 py-4">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg border bg-muted/30" />
              ))
            ) : filtered.length === 0 ? (
              <div className="rounded-lg border border-dashed px-6 py-10 text-center">
                <Target className="mx-auto mb-3 h-6 w-6 text-muted-foreground/50" />
                <p className="text-sm font-medium">No KPIs match.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create one from the KPIs page first.
                </p>
              </div>
            ) : (
              filtered.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  onClick={() => handlePick(k.id)}
                  className="flex w-full items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left transition hover:border-primary/30 hover:shadow-sm"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm font-medium truncate">{k.metric.name}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      {k.metric_type_tag && <span>{k.metric_type_tag}</span>}
                      {k.program_tag && <span>· {k.program_tag}</span>}
                      {k.target_value != null && (
                        <span>· target {k.target_value.toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm">
                    Add
                  </Button>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
