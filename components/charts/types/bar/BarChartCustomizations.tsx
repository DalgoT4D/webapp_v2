'use client';

import { useState } from 'react';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChartPaletteSelector } from '../../ChartPaletteSelector';
import { ChartColorSwatchGrid } from '../../ChartColorSwatchGrid';
import { ChartNamedColorRows } from '../../ChartNamedColorRows';
import type { ChartMetric } from '@/types/charts';
import { PRESET_CHART_PALETTES } from '@/constants/chart-palettes';
import {
  getBarColorTarget,
  getChartNamedColorEntries,
  getDimensionColorMap,
} from '@/lib/chart-color-customizations';

// Fallback default color order (first colors from default palette)
const DEFAULT_SERIES_COLORS = PRESET_CHART_PALETTES[0].colors.map((c) => c.solid);

function getMetricLabel(metric: ChartMetric): string {
  if (metric.alias) return metric.alias;
  const col = metric.column ?? '*';
  return `${metric.aggregation}(${col})`;
}

function getColorGuidance({
  isMultiMetric,
  hasExtraDimension,
  primaryDimensionLabel,
  extraDimensionLabel,
}: {
  isMultiMetric: boolean;
  hasExtraDimension?: boolean;
  primaryDimensionLabel?: string;
  extraDimensionLabel?: string;
}) {
  if (hasExtraDimension) {
    return `With an extra dimension, you can color up to two dimensions here. Use Color Dimension to switch between ${primaryDimensionLabel || 'the main dimension'} and ${extraDimensionLabel || 'the added dimension'}.`;
  }

  if (isMultiMetric) {
    return `With multiple metrics, colors can only be changed per metric. Categories in ${primaryDimensionLabel || 'the main dimension'} keep the same color inside each metric.`;
  }

  return 'Pick one default color for all bars, or override individual category values.';
}

interface BarChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (keyOrUpdates: string | Record<string, any>, value?: any) => void;
  disabled?: boolean;
  hasExtraDimension?: boolean;
  metrics?: ChartMetric[];
  chartConfig?: Record<string, any>;
  primaryDimensionLabel?: string;
  extraDimensionLabel?: string;
}

export function BarChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasExtraDimension,
  metrics,
  chartConfig,
  primaryDimensionLabel,
  extraDimensionLabel,
}: BarChartCustomizationsProps) {
  const [selectedMetricIndex, setSelectedMetricIndex] = useState<number | null>(null);

  const isMultiMetric = !hasExtraDimension && metrics && metrics.length > 1;
  const primaryDimensionColors = getDimensionColorMap(customizations);
  const storedExtraDimensionColors = getDimensionColorMap(customizations, 'extra_dimension_colors');
  const extraDimensionColors =
    Object.keys(storedExtraDimensionColors).length > 0
      ? storedExtraDimensionColors
      : typeof customizations.bar_color_target === 'string'
        ? {}
        : getDimensionColorMap(customizations);
  const barColorTarget = hasExtraDimension ? getBarColorTarget(customizations, true) : 'primary';
  const activeDimensionColors =
    barColorTarget === 'extra' ? extraDimensionColors : primaryDimensionColors;
  const dimensionColorEntries = getChartNamedColorEntries({
    chartType: 'bar',
    chartConfig,
    customizations,
  });
  const paletteColors = Array.isArray(customizations.color_palette_colors)
    ? customizations.color_palette_colors.filter(
        (color: unknown): color is string => typeof color === 'string' && Boolean(color.trim())
      )
    : [];
  const baseBarColor = customizations.chart_color ?? paletteColors[0] ?? DEFAULT_SERIES_COLORS[0];
  const showExtraDimensionPalette = hasExtraDimension && barColorTarget === 'extra';
  const colorGuidance = getColorGuidance({
    isMultiMetric,
    hasExtraDimension,
    primaryDimensionLabel,
    extraDimensionLabel,
  });

  // series_colors is string[] indexed by series position
  const seriesColors: string[] = customizations.series_colors ?? [];

  const updateSeriesColor = (index: number, color: string | null) => {
    const updated = [...seriesColors];
    if (color) {
      updated[index] = color;
    } else {
      delete updated[index];
    }
    updateCustomization('series_colors', updated);
  };

  const updateDimensionColor = (key: string, color: string | null) => {
    const customizationKey =
      barColorTarget === 'extra' ? 'extra_dimension_colors' : 'dimension_colors';
    const updated = { ...activeDimensionColors };
    if (color) {
      updated[key] = color;
    } else {
      delete updated[key];
    }
    updateCustomization(customizationKey, Object.keys(updated).length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Basic Display Options */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Display Options</h4>

        <div className="space-y-2">
          <Label>Orientation</Label>
          <RadioGroup
            value={customizations.orientation || 'vertical'}
            onValueChange={(value) => updateCustomization('orientation', value)}
            disabled={disabled}
          >
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="vertical" id="vertical" />
              <Label htmlFor="vertical">Vertical</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="horizontal" id="horizontal" />
              <Label htmlFor="horizontal">Horizontal</Label>
            </div>
          </RadioGroup>
        </div>

        {hasExtraDimension && (
          <div className="flex items-center space-x-2">
            <Switch
              id="stacked"
              checked={customizations.stacked || false}
              onCheckedChange={(checked) => updateCustomization('stacked', checked)}
              disabled={disabled}
            />
            <Label htmlFor="stacked">Stacked Bars</Label>
          </div>
        )}

        <div className="flex items-center space-x-2">
          <Switch
            id="showTooltip"
            checked={customizations.showTooltip !== false}
            onCheckedChange={(checked) => updateCustomization('showTooltip', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showTooltip">Show Tooltip on Hover</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="showLegend"
            checked={customizations.showLegend !== false}
            onCheckedChange={(checked) => updateCustomization('showLegend', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showLegend">Show Legend</Label>
        </div>

        {customizations.showLegend !== false && (
          <>
            <div className="space-y-2">
              <Label>Legend Display</Label>
              <RadioGroup
                value={customizations.legendDisplay || 'paginated'}
                onValueChange={(value) => {
                  // Ensure legendPosition has a default value
                  updateCustomization({
                    ...(customizations.legendPosition ? {} : { legendPosition: 'right' }),
                    legendDisplay: value,
                  });
                }}
                disabled={disabled}
              >
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="paginated" id="bar-paginated" />
                  <Label htmlFor="bar-paginated">Paginated Legends</Label>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="all" id="bar-all" />
                  <Label htmlFor="bar-all">Show All Legends in Chart Area</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="barLegendPosition">Legend Position</Label>
              <Select
                value={customizations.legendPosition || 'right'}
                onValueChange={(value) => updateCustomization('legendPosition', value)}
                disabled={disabled}
              >
                <SelectTrigger id="barLegendPosition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top">Top</SelectItem>
                  <SelectItem value="bottom">Bottom</SelectItem>
                  <SelectItem value="left">Left</SelectItem>
                  <SelectItem value="right">Right</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>

      {/* Data Labels */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Data Labels</h4>

        <div className="flex items-center space-x-2">
          <Switch
            id="showDataLabels"
            checked={customizations.showDataLabels || false}
            onCheckedChange={(checked) => updateCustomization('showDataLabels', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showDataLabels">Show Data Labels</Label>
        </div>

        {customizations.showDataLabels && (
          <div className="space-y-2">
            <Label htmlFor="dataLabelPosition">Data Label Position</Label>
            <Select
              value={customizations.dataLabelPosition || 'top'}
              onValueChange={(value) => updateCustomization('dataLabelPosition', value)}
              disabled={disabled}
            >
              <SelectTrigger id="dataLabelPosition">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="inside">Middle</SelectItem>
                <SelectItem value="insideBottom">Bottom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Axis Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Axis Configuration</h4>

        <div className="space-y-2">
          <Label htmlFor="xAxisTitle">X-Axis Title</Label>
          <Input
            id="xAxisTitle"
            value={customizations.xAxisTitle || ''}
            onChange={(e) => updateCustomization('xAxisTitle', e.target.value)}
            placeholder="Enter X-axis title"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="xAxisLabelRotation">X-Axis Label Rotation</Label>
          <Select
            value={customizations.xAxisLabelRotation || 'horizontal'}
            onValueChange={(value) => updateCustomization('xAxisLabelRotation', value)}
            disabled={disabled}
          >
            <SelectTrigger id="xAxisLabelRotation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal (0°)</SelectItem>
              <SelectItem value="45">45 degrees</SelectItem>
              <SelectItem value="vertical">Vertical (90°)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="yAxisTitle">Y-Axis Title</Label>
          <Input
            id="yAxisTitle"
            value={customizations.yAxisTitle || ''}
            onChange={(e) => updateCustomization('yAxisTitle', e.target.value)}
            placeholder="Enter Y-axis title"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="yAxisLabelRotation">Y-Axis Label Rotation</Label>
          <Select
            value={customizations.yAxisLabelRotation || 'horizontal'}
            onValueChange={(value) => updateCustomization('yAxisLabelRotation', value)}
            disabled={disabled}
          >
            <SelectTrigger id="yAxisLabelRotation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="horizontal">Horizontal (0°)</SelectItem>
              <SelectItem value="45">45 degrees</SelectItem>
              <SelectItem value="vertical">Vertical (90°)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4 pb-4 border-b">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-medium">Colors</h4>
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Color guidance"
                data-testid="color-guidance-trigger"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs leading-relaxed">
              {colorGuidance}
            </TooltipContent>
          </Tooltip>
        </div>

        {isMultiMetric ? (
          // Per-metric color picker for grouped bar charts
          <div className="space-y-2">
            {metrics.map((metric, index) => {
              const label = getMetricLabel(metric);
              const currentColor =
                seriesColors[index] ?? DEFAULT_SERIES_COLORS[index % DEFAULT_SERIES_COLORS.length];
              const isExpanded = selectedMetricIndex === index;

              return (
                <div
                  key={`${metric.aggregation}-${metric.column ?? '*'}`}
                  className="rounded-lg border overflow-hidden"
                >
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedMetricIndex(isExpanded ? null : index)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    data-testid={`metric-color-row-${index}`}
                  >
                    <div
                      className="w-4 h-4 rounded-sm flex-shrink-0 border border-black/10"
                      style={{ backgroundColor: currentColor }}
                    />
                    <span className="text-sm flex-1 text-left truncate">{label}</span>
                    <span className="text-xs text-muted-foreground">{isExpanded ? '▲' : '▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                      <ChartColorSwatchGrid
                        selectedSolid={seriesColors[index] ?? undefined}
                        onSelect={(color) => updateSeriesColor(index, color.solid)}
                        label={`Color for ${label}`}
                        disabled={disabled}
                      />
                      {seriesColors[index] && (
                        <button
                          type="button"
                          onClick={() => updateSeriesColor(index, null)}
                          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
                        >
                          Reset to default
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4">
            {hasExtraDimension && (
              <div className="space-y-2">
                <Label htmlFor="barColorTarget">Color Dimension</Label>
                <Select
                  value={barColorTarget}
                  onValueChange={(value) => updateCustomization('bar_color_target', value)}
                  disabled={disabled}
                >
                  <SelectTrigger id="barColorTarget" aria-label="Color Dimension">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="extra">
                      {extraDimensionLabel || 'Additional Dimension'}
                    </SelectItem>
                    <SelectItem value="primary">
                      {primaryDimensionLabel || 'Primary Dimension'}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {barColorTarget === 'primary' && (
              <ChartColorSwatchGrid
                selectedSolid={baseBarColor}
                onSelect={(color) => {
                  updateCustomization({
                    chart_color: color.solid || null,
                    color_palette_colors: undefined,
                    dimension_colors: undefined,
                  });
                }}
                label="Default Color"
                disabled={disabled}
              />
            )}

            {showExtraDimensionPalette && (
              <ChartPaletteSelector
                selectedColors={customizations.color_palette_colors ?? null}
                onSelect={(colors) => updateCustomization('color_palette_colors', colors)}
                disabled={disabled}
              />
            )}

            <ChartNamedColorRows
              entries={dimensionColorEntries}
              selectedColors={activeDimensionColors}
              onChange={updateDimensionColor}
              disabled={disabled}
              fallbackColors={
                barColorTarget === 'extra'
                  ? paletteColors.length > 0
                    ? paletteColors
                    : DEFAULT_SERIES_COLORS
                  : [baseBarColor]
              }
              title={
                barColorTarget === 'extra'
                  ? `${extraDimensionLabel || 'Additional Dimension'} Colors`
                  : hasExtraDimension
                    ? `${primaryDimensionLabel || 'Primary Dimension'} Colors`
                    : 'Category Colors'
              }
              description={
                barColorTarget === 'extra'
                  ? 'Pick a palette for the additional dimension, then override specific values when needed.'
                  : hasExtraDimension
                    ? 'Override specific primary-dimension values while the remaining bars keep using the default color.'
                    : 'Override specific category values while the remaining bars keep using the default color.'
              }
              resetLabel={
                barColorTarget === 'extra' ? 'Reset to palette default' : 'Reset to default color'
              }
            />
          </div>
        )}
      </div>
    </div>
  );
}
