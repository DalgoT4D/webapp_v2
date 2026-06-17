'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { useMetrics } from '@/hooks/api/useMetrics';
import { cn } from '@/lib/utils';

interface MetricPickerProps {
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  pageSize?: number;
}

export function MetricPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Search from your Metrics Library',
  pageSize = 100,
}: MetricPickerProps) {
  const { data: metrics, isLoading } = useMetrics({ pageSize });

  const items = useMemo(
    () =>
      metrics.map((m) => ({
        value: String(m.id),
        label: m.name,
        data_type: `${m.schema_name}.${m.table_name}${m.description ? ' · ' + m.description : ''}`,
        disabled: false,
      })),
    [metrics]
  );

  return (
    <Combobox
      disabled={disabled}
      items={items}
      value={value ? String(value) : ''}
      onValueChange={(v) => onChange(v ? parseInt(v, 10) : null)}
      placeholder={placeholder}
      searchPlaceholder="Search metrics..."
      renderItem={(item) => {
        const m = metrics.find((x) => String(x.id) === item.value);
        return (
          <div className="flex items-center justify-between w-full gap-2">
            <div className="min-w-0">
              <div className="font-medium">{item.label}</div>
              <div className="text-xs text-muted-foreground truncate">{item.data_type}</div>
            </div>
            <span
              className={cn(
                'shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border',
                m?.column_expression
                  ? 'bg-green-50 text-green-700 border-green-200'
                  : 'bg-gray-50 text-gray-600 border-gray-200'
              )}
            >
              {m?.column_expression ? 'Calculated' : 'Simple'}
            </span>
          </div>
        );
      }}
      footer={
        isLoading ? undefined : (
          <a
            href="/metrics?create=true"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full py-1 text-sm font-medium"
            style={{ color: 'var(--primary)' }}
          >
            <Plus className="h-3.5 w-3.5" />
            CREATE A NEW METRIC
          </a>
        )
      }
    />
  );
}
