'use client';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import { useDashboardBranding } from '@/hooks/api/useDashboardBranding';
import {
  PRESET_CHART_PALETTES,
  DEFAULT_CHART_PALETTE_COLORS,
  getSolidColors,
} from '@/constants/chart-palettes';

function buildPaletteGradient(colors: string[]) {
  return `linear-gradient(90deg, ${colors.join(', ')})`;
}

interface ChartPaletteSelectorProps {
  /**
   * Currently selected palette solid colors array.
   * null / undefined means "use org default" (no per-chart override).
   */
  selectedColors?: string[] | null;
  /** Called with the chosen solid color array, or null to clear the override */
  onSelect: (colors: string[] | null) => void;
  disabled?: boolean;
}

/**
 * Full-palette row selector for charts that use multiple colors (for example pie and multi-series line charts).
 * Always shows an "Org Default" row at the top reflecting the org's current branding palette,
 * followed by all preset palettes.
 */
export function ChartPaletteSelector({
  selectedColors,
  onSelect,
  disabled,
}: ChartPaletteSelectorProps) {
  const { branding } = useDashboardBranding();
  // Only show a dedicated "Org Default" row when the org has configured a custom palette.
  // If there's no custom palette, the "Default" preset IS the org default — no duplication needed.
  const hasCustomOrgPalette = Boolean(branding?.chart_palette_colors);
  const orgPalette = branding?.chart_palette_colors ?? DEFAULT_CHART_PALETTE_COLORS;

  const isOrgDefault = !selectedColors && hasCustomOrgPalette;

  // When no selection and no custom org palette, the Default preset is the active default
  const defaultPresetColors = getSolidColors(PRESET_CHART_PALETTES[0].colors);
  const effectiveColors = selectedColors ?? (hasCustomOrgPalette ? null : defaultPresetColors);

  const isSelected = (colors: string[]) =>
    JSON.stringify(colors) === JSON.stringify(effectiveColors);

  return (
    <div className="space-y-2">
      <Label>Color Palette</Label>
      <div className="space-y-1.5">
        {/* Org Default — only shown when org has a custom palette configured */}
        {hasCustomOrgPalette && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(null)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all text-left disabled:cursor-not-allowed disabled:opacity-50',
              isOrgDefault
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
            )}
            data-testid="palette-org-default"
          >
            <div
              aria-hidden="true"
              className="h-3 w-28 flex-shrink-0 rounded-full border border-black/10"
              style={{ backgroundImage: buildPaletteGradient(orgPalette.slice(0, 8)) }}
            />
            <div className="min-w-0 flex-1">
              <span className="text-sm text-gray-700">Org Default</span>
              <p className="text-xs text-gray-500">Current workspace palette</p>
            </div>
            {isOrgDefault && <Check className="w-3 h-3 text-blue-500 flex-shrink-0" />}
          </button>
        )}

        {/* Preset palettes */}
        {PRESET_CHART_PALETTES.map((palette) => {
          const solidColors = getSolidColors(palette.colors);
          const active = isSelected(solidColors);
          return (
            <button
              key={palette.name}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(solidColors)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2 rounded-lg border-2 transition-all text-left disabled:cursor-not-allowed disabled:opacity-50',
                active
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              )}
              data-testid={`palette-${palette.name.toLowerCase().replace(/\s/g, '-')}`}
            >
              <div
                aria-hidden="true"
                className="h-3 w-28 flex-shrink-0 rounded-full border border-black/10"
                style={{ backgroundImage: buildPaletteGradient(solidColors.slice(0, 8)) }}
              />
              <div className="min-w-0 flex-1">
                <span className="text-sm text-gray-700">{palette.name}</span>
                <p className="text-xs text-gray-500">
                  {palette.name.includes('Gradient') ? 'Sequential range' : 'Categorical default'}
                </p>
              </div>
              {active && <Check className="w-3 h-3 text-blue-500 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}
