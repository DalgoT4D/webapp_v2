'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAnnotations, useSaveAnnotation } from '@/hooks/api/useMetrics';
import type { MetricDefinition } from '@/types/metrics';

interface MetricAnnotationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metric: MetricDefinition | null;
  canEdit: boolean;
  onSaved?: () => void;
}

function generatePeriodOptions(timeGrain: string): Array<{ value: string; label: string }> {
  const now = new Date();
  const options: Array<{ value: string; label: string }> = [];

  if (timeGrain === 'month') {
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
      options.push({ value, label });
    }
  } else if (timeGrain === 'quarter') {
    for (let i = 0; i < 8; i++) {
      const monthOffset = i * 3;
      const d = new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
      const q = Math.floor(d.getMonth() / 3) + 1;
      options.push({
        value: `${d.getFullYear()}-Q${q}`,
        label: `Q${q} ${d.getFullYear()}`,
      });
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const year = now.getFullYear() - i;
      options.push({ value: String(year), label: String(year) });
    }
  }

  return options;
}

export function MetricAnnotationDialog({
  open,
  onOpenChange,
  metric,
  canEdit,
  onSaved,
}: MetricAnnotationDialogProps) {
  const periodOptions = useMemo(
    () => generatePeriodOptions(metric?.time_grain || 'month'),
    [metric?.time_grain]
  );

  const [selectedPeriod, setSelectedPeriod] = useState(periodOptions[0]?.value ?? '');
  const [rationale, setRationale] = useState('');
  const [quoteText, setQuoteText] = useState('');
  const [quoteAttribution, setQuoteAttribution] = useState('');

  const { data: annotations, mutate: refreshAnnotations } = useAnnotations(
    open && metric ? metric.id : null
  );

  const { trigger: saveAnnotation, isMutating: isSaving } = useSaveAnnotation(metric?.id ?? null);

  // Load existing annotation when period changes
  useEffect(() => {
    if (!annotations || !selectedPeriod) return;
    const existing = annotations.find((a) => a.period_key === selectedPeriod);
    if (existing) {
      setRationale(existing.rationale);
      setQuoteText(existing.quote_text);
      setQuoteAttribution(existing.quote_attribution);
    } else {
      setRationale('');
      setQuoteText('');
      setQuoteAttribution('');
    }
  }, [annotations, selectedPeriod]);

  // Reset period when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedPeriod(periodOptions[0]?.value ?? '');
    }
  }, [open, periodOptions]);

  const handleSave = async () => {
    if (!metric || !selectedPeriod) return;

    await saveAnnotation({
      period_key: selectedPeriod,
      rationale,
      quote_text: quoteText,
      quote_attribution: quoteAttribution,
    });

    refreshAnnotations();
    onSaved?.();
    onOpenChange(false);
  };

  if (!metric) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{metric.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Period selector */}
          <div className="grid gap-1.5">
            <Label>Period</Label>
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Rationale */}
          <div className="grid gap-1.5">
            <Label htmlFor="rationale">Rationale</Label>
            <Textarea
              id="rationale"
              placeholder="e.g. Three facilities paused training during monsoon season"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              disabled={!canEdit}
              rows={3}
            />
          </div>

          {/* Beneficiary quote */}
          <div className="grid gap-1.5">
            <Label htmlFor="quote-text">Beneficiary Quote</Label>
            <Textarea
              id="quote-text"
              placeholder="e.g. Since the health centre moved, I have to walk 45 minutes with my child"
              value={quoteText}
              onChange={(e) => setQuoteText(e.target.value)}
              disabled={!canEdit}
              rows={3}
            />
          </div>

          {/* Attribution */}
          <div className="grid gap-1.5">
            <Label htmlFor="quote-attr">Attribution</Label>
            <Input
              id="quote-attr"
              placeholder="e.g. Beneficiary, Karnataka"
              value={quoteAttribution}
              onChange={(e) => setQuoteAttribution(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
          {canEdit && (
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
