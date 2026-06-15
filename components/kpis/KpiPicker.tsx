'use client';

import { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';
import { useKPIs } from '@/hooks/api/useKPIs';

interface KpiPickerProps {
  value: number | null;
  onChange: (id: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
  pageSize?: number;
}

export function KpiPicker({
  value,
  onChange,
  disabled,
  placeholder = 'Search from your KPI Library',
  pageSize = 100,
}: KpiPickerProps) {
  const { data: kpis } = useKPIs({ pageSize });

  const items = useMemo(
    () =>
      kpis.map((k) => ({
        value: String(k.id),
        label: k.name,
        data_type: `${k.metric?.schema_name ?? ''}.${k.metric?.table_name ?? ''} · target ${k.target_value ?? '—'} · ${k.direction === 'increase' ? 'increase is better' : 'decrease is better'}`,
        disabled: false,
      })),
    [kpis]
  );

  return (
    <Combobox
      disabled={disabled}
      items={items}
      value={value ? String(value) : ''}
      onValueChange={(v) => onChange(v ? parseInt(v, 10) : null)}
      placeholder={placeholder}
      searchPlaceholder="Search KPIs..."
      renderItem={(item) => (
        <div className="min-w-0 w-full">
          <div className="font-medium">{item.label}</div>
          <div className="text-xs text-muted-foreground truncate">{item.data_type}</div>
        </div>
      )}
      footer={
        <a
          href="/kpis?create=true"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1.5 w-full py-1 text-sm font-medium"
          style={{ color: 'var(--primary)' }}
        >
          <Plus className="h-3.5 w-3.5" />
          CREATE A NEW KPI
        </a>
      }
    />
  );
}
