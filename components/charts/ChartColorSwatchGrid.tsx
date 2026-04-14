'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  PRESET_CHART_PALETTES,
  DEFAULT_CHART_PALETTE_COLORS,
  type PaletteColor,
} from '@/constants/chart-palettes';

interface ChartColorSwatchGridProps {
  /** The currently selected solid hex color, or undefined for none */
  selectedSolid?: string;
  /** Called with the full PaletteColor (solid + light) when user picks a swatch */
  onSelect: (color: PaletteColor) => void;
  /** Label shown above the grid */
  label?: string;
  disabled?: boolean;
}

/**
 * Flat grid showing every solid color from every palette.
 * Used by bar/line (single series color) and map (choropleth color) customizations.
 * The `light` value on each PaletteColor is passed to onSelect so the caller
 * can use it for gradient ranges (map) without any extra computation.
 */
export function ChartColorSwatchGrid({
  selectedSolid,
  onSelect,
  label = 'Series Color',
  disabled,
}: ChartColorSwatchGridProps) {
  // When no color is explicitly chosen, the first color of the Default palette is the effective default
  const effectiveSelected = selectedSolid ?? DEFAULT_CHART_PALETTE_COLORS[0];

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="space-y-2">
        {PRESET_CHART_PALETTES.map((palette) => (
          <div key={palette.name} className="space-y-1">
            <span className="text-xs text-muted-foreground">{palette.name}</span>
            <div className="flex gap-1.5 flex-wrap">
              {palette.colors.map((color) => (
                <button
                  key={color.solid}
                  type="button"
                  disabled={disabled}
                  onClick={() => onSelect(color)}
                  className={cn(
                    'w-7 h-7 rounded-md border-2 transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50',
                    effectiveSelected === color.solid
                      ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                      : 'border-transparent hover:border-gray-300'
                  )}
                  style={{ backgroundColor: color.solid }}
                  title={color.solid}
                  data-testid={`color-swatch-${color.solid.replace('#', '')}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      {selectedSolid && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onSelect({ solid: '', light: '' })}
          className="text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed"
          data-testid="color-swatch-clear"
        >
          Reset to org default
        </button>
      )}
    </div>
  );
}
