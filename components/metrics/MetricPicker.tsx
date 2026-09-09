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
  hideCreateLink?: boolean;
  /**
   * Show at most this many metrics, taking the first ones the API returned (after
   * `pinMetricName`, where that one is present).
   *
   * For the onboarding walkthrough, which caps the list at one: the guided KPI is a
   * demonstration and a full scrollable list gave the user a decision to make where the flow
   * only needed a click. Capping the options is how that is enforced — there is nothing to
   * scroll to and nothing else to pick — rather than by blocking clicks on rows that are still
   * on screen.
   */
  maxItems?: number;
  /**
   * Sort the metric with this exact name to the front, so a capped list offers that one.
   *
   * The walkthrough names the seeded sample metric here — capping alone left the step on
   * whatever the API happened to return first, which could be any measure at all. Ignored when
   * no metric matches, which leaves the previous behaviour (the first metric returned) intact.
   */
  pinMetricName?: string;
}

export function MetricPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Search from your Metrics Library',
  pageSize = 100,
  hideCreateLink = false,
  maxItems,
  pinMetricName,
}: MetricPickerProps) {
  const { data: metrics, isLoading } = useMetrics({ pageSize });

  const items = useMemo(() => {
    const pinned = pinMetricName
      ? metrics.filter((m) => m.name === pinMetricName)
      : ([] as typeof metrics);
    const ordered =
      pinned.length > 0 ? [...pinned, ...metrics.filter((m) => !pinned.includes(m))] : metrics;
    return (maxItems === undefined ? ordered : ordered.slice(0, maxItems)).map((m) => ({
      value: String(m.id),
      label: m.name,
      data_type: `${m.schema_name}.${m.table_name}${m.description ? ' · ' + m.description : ''}`,
      disabled: false,
    }));
  }, [metrics, maxItems, pinMetricName]);

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
        isLoading || hideCreateLink ? undefined : (
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
