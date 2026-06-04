'use client';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { MetricConsumersResponse } from '@/types/metrics';

type ConsumerLinksVariant = 'default' | 'inherit';

interface ConsumerLinksProps {
  consumers: MetricConsumersResponse;
  variant?: ConsumerLinksVariant;
}

function ConsumerCount({
  count,
  label,
  items,
  getHref,
  getName,
  variant,
}: {
  count: number;
  label: string;
  items: { id: number; name?: string; title?: string }[];
  getHref: (item: { id: number }) => string;
  getName: (item: { id: number; name?: string; title?: string }) => string;
  variant: ConsumerLinksVariant;
}) {
  if (count === 0) return null;

  const text = `${count} ${label}${count > 1 ? 's' : ''}`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={
            variant === 'inherit'
              ? 'underline cursor-pointer hover:opacity-80 text-amber-700'
              : 'underline font-medium cursor-pointer hover:opacity-80'
          }
          style={variant === 'inherit' ? undefined : { color: 'var(--primary)' }}
        >
          {text}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 px-4 py-3" align="start">
        <div className="space-y-0.5">
          {items.map((item) => (
            <a
              key={item.id}
              href={getHref(item)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-sm text-foreground hover:underline truncate"
            >
              {getName(item)}
            </a>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function ConsumerLinks({ consumers, variant = 'default' }: ConsumerLinksProps) {
  const hasCharts = consumers.charts.length > 0;
  const hasKpis = consumers.kpis.length > 0;

  if (!hasCharts && !hasKpis) {
    return <span className="text-sm text-gray-400">unused</span>;
  }

  return (
    <span className="text-sm inline-flex items-center gap-1">
      <ConsumerCount
        count={consumers.charts.length}
        label="Chart"
        items={consumers.charts}
        getHref={(item) => `/charts/${item.id}`}
        getName={(item) => (item as any).title || `Chart #${item.id}`}
        variant={variant}
      />
      {hasCharts && hasKpis && <span>,</span>}
      <ConsumerCount
        count={consumers.kpis.length}
        label="KPI"
        items={consumers.kpis}
        getHref={(item) => `/kpis?open=${item.id}`}
        getName={(item) => (item as any).name || `KPI #${item.id}`}
        variant={variant}
      />
    </span>
  );
}
