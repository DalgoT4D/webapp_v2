'use client';

import { useState } from 'react';
import { ChartColorSwatchGrid } from './ChartColorSwatchGrid';
import { DEFAULT_CHART_PALETTE_COLORS } from '@/constants/chart-palettes';
import type { NamedChartColorEntry } from '@/lib/chart-color-customizations';

interface ChartNamedColorRowsProps {
  entries: NamedChartColorEntry[];
  selectedColors: Record<string, string>;
  onChange: (key: string, color: string | null) => void;
  disabled?: boolean;
  rowTestIdPrefix?: string;
  title?: string;
  description?: string;
  fallbackColors?: string[];
  resetLabel?: string;
}

export function ChartNamedColorRows({
  entries,
  selectedColors,
  onChange,
  disabled,
  rowTestIdPrefix = 'dimension-color-row',
  title = 'Dimension Colors',
  description = 'Override specific dimension values while the remaining values keep using the palette.',
  fallbackColors,
  resetLabel = 'Reset to palette default',
}: ChartNamedColorRowsProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const effectiveFallbackColors =
    fallbackColors && fallbackColors.length > 0 ? fallbackColors : DEFAULT_CHART_PALETTE_COLORS;

  if (entries.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <h5 className="text-sm font-medium">{title}</h5>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>

      {entries.map((entry, index) => {
        const isExpanded = selectedKey === entry.key;
        const currentColor =
          selectedColors[entry.key] ??
          effectiveFallbackColors[index % effectiveFallbackColors.length] ??
          DEFAULT_CHART_PALETTE_COLORS[0];

        return (
          <div key={entry.key} className="rounded-lg border overflow-hidden">
            <button
              type="button"
              disabled={disabled}
              onClick={() => setSelectedKey(isExpanded ? null : entry.key)}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              data-testid={`${rowTestIdPrefix}-${index}`}
            >
              <div
                className="w-4 h-4 rounded-sm flex-shrink-0 border border-black/10"
                style={{ backgroundColor: currentColor }}
              />
              <span className="text-sm flex-1 text-left truncate">{entry.label}</span>
              <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                <ChartColorSwatchGrid
                  selectedSolid={selectedColors[entry.key] ?? undefined}
                  onSelect={(color) => onChange(entry.key, color.solid || null)}
                  label={`Color for ${entry.label}`}
                  disabled={disabled}
                />
                {selectedColors[entry.key] && (
                  <button
                    type="button"
                    onClick={() => onChange(entry.key, null)}
                    className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                  >
                    {resetLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
