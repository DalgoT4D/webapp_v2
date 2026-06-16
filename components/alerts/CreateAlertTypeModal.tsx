'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertType } from '@/types/alerts';
import { useKPIs } from '@/hooks/api/useKPIs';
import { useMetrics } from '@/hooks/api/useMetrics';

interface CreateAlertTypeModalProps {
  onSelect: (type: AlertType) => void;
  /** The trigger button — rendered via Radix `asChild`. */
  children: React.ReactNode;
}

interface Option {
  value: AlertType;
  title: string;
  description: string;
  testId: string;
  createPath?: string;
  createLabel?: string;
}

const OPTIONS: Option[] = [
  {
    value: AlertType.KPI_RAG,
    title: 'Use a KPI',
    description: 'Notify stakeholders on key state changes',
    testId: 'create-kpi-alert',
    createPath: '/kpis?create=true',
    createLabel: 'Create KPI',
  },
  {
    value: AlertType.METRIC_THRESHOLD,
    title: 'Use a metric',
    description: 'Trigger alerts against your computed metrics',
    testId: 'create-metric-alert',
    createPath: '/metrics?create=true',
    createLabel: 'Create metric',
  },
  {
    value: AlertType.STANDALONE,
    title: 'Build custom alerts',
    description: 'Write a custom query.',
    testId: 'create-standalone-alert',
  },
];

export function CreateAlertTypeModal({ onSelect, children }: CreateAlertTypeModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AlertType>(AlertType.KPI_RAG);

  const { total: kpiCount, isLoading: kpiLoading } = useKPIs({ pageSize: 1 });
  const { total: metricCount, isLoading: metricLoading } = useMetrics({ pageSize: 1 });

  const disabledMap: Record<AlertType, boolean> = {
    [AlertType.KPI_RAG]: !kpiLoading && kpiCount === 0,
    [AlertType.METRIC_THRESHOLD]: !metricLoading && metricCount === 0,
    [AlertType.STANDALONE]: false,
  };

  // If the currently selected type became disabled, pick the first enabled option.
  useEffect(() => {
    if (disabledMap[selectedType]) {
      const firstEnabled = OPTIONS.find((o) => !disabledMap[o.value]);
      if (firstEnabled) setSelectedType(firstEnabled.value);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabledMap[AlertType.KPI_RAG], disabledMap[AlertType.METRIC_THRESHOLD], selectedType]);

  const handleNext = () => {
    if (disabledMap[selectedType]) return;
    onSelect(selectedType);
    setOpen(false);
  };

  const goToCreate = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Select alert type</DialogTitle>
        </DialogHeader>
        <RadioGroup
          value={selectedType}
          onValueChange={(v) => setSelectedType(v as AlertType)}
          className="space-y-3 py-2"
        >
          {OPTIONS.map((opt) => {
            const id = `alert-type-${opt.value}`;
            const isSelected = selectedType === opt.value;
            const isDisabled = disabledMap[opt.value];
            return (
              <div
                key={opt.value}
                className={cn(
                  'flex items-start justify-between gap-3 rounded-md border p-4 transition-colors',
                  isDisabled
                    ? 'border-border opacity-60'
                    : isSelected
                      ? 'border-primary'
                      : 'border-border hover:bg-muted/50'
                )}
              >
                <label
                  htmlFor={id}
                  data-testid={opt.testId}
                  className={cn(
                    'flex items-start gap-3 flex-1',
                    isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                  )}
                >
                  <RadioGroupItem
                    value={opt.value}
                    id={id}
                    disabled={isDisabled}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{opt.title}</div>
                    <div className="text-sm text-muted-foreground mt-0.5">{opt.description}</div>
                  </div>
                </label>
                {isDisabled && opt.createPath && opt.createLabel && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => goToCreate(opt.createPath!)}
                    data-testid={`${opt.testId}-create`}
                  >
                    <Plus className="w-3 h-3 mr-1" />
                    {opt.createLabel}
                  </Button>
                )}
              </div>
            );
          })}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} data-testid="alert-type-cancel">
            CANCEL
          </Button>
          <Button
            variant="primary"
            onClick={handleNext}
            disabled={disabledMap[selectedType]}
            data-testid="alert-type-next"
          >
            NEXT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
