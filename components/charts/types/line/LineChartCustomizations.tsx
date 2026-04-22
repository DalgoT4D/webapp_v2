'use client';

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
import { ChartColorSwatchGrid } from '../../ChartColorSwatchGrid';
import { ChartPaletteSelector } from '../../ChartPaletteSelector';
import { ChartNamedColorRows } from '../../ChartNamedColorRows';
import { getChartNamedColorEntries, getDimensionColorMap } from '@/lib/chart-color-customizations';

interface LineChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (keyOrUpdates: string | Record<string, any>, value?: any) => void;
  disabled?: boolean;
  hasExtraDimension?: boolean;
  chartConfig?: Record<string, any>;
}

export function LineChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasExtraDimension,
  chartConfig,
}: LineChartCustomizationsProps) {
  const dimensionColors = getDimensionColorMap(customizations);
  const dimensionColorEntries = getChartNamedColorEntries({
    chartType: 'line',
    chartConfig,
    customizations,
  });

  const updateDimensionColor = (key: string, color: string | null) => {
    const updated = { ...dimensionColors };
    if (color) {
      updated[key] = color;
    } else {
      delete updated[key];
    }
    updateCustomization('dimension_colors', Object.keys(updated).length > 0 ? updated : undefined);
  };

  return (
    <div className="space-y-6">
      {/* Display Options */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Display Options</h4>

        <div className="space-y-2">
          <Label>Line Style</Label>
          <RadioGroup
            value={customizations.lineStyle || 'smooth'}
            onValueChange={(value) => updateCustomization('lineStyle', value)}
            disabled={disabled}
          >
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="smooth" id="smooth" />
              <Label htmlFor="smooth">Smooth Curves</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="straight" id="straight" />
              <Label htmlFor="straight">Straight Lines</Label>
            </div>
          </RadioGroup>
        </div>

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
            id="showDataPoints"
            checked={customizations.showDataPoints !== false}
            onCheckedChange={(checked) => updateCustomization('showDataPoints', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showDataPoints">Show Data Points</Label>
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
                  <RadioGroupItem value="paginated" id="line-paginated" />
                  <Label htmlFor="line-paginated">Paginated Legends</Label>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="all" id="line-all" />
                  <Label htmlFor="line-all">Show All Legends in Chart Area</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lineLegendPosition">Legend Position</Label>
              <Select
                value={customizations.legendPosition || 'right'}
                onValueChange={(value) => updateCustomization('legendPosition', value)}
                disabled={disabled}
              >
                <SelectTrigger id="lineLegendPosition">
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
                <SelectItem value="top">Above Point</SelectItem>
                <SelectItem value="bottom">Below Point</SelectItem>
                <SelectItem value="left">Left of Point</SelectItem>
                <SelectItem value="right">Right of Point</SelectItem>
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
        <h4 className="text-sm font-medium">Colors</h4>
        <div className="space-y-4">
          {hasExtraDimension || dimensionColorEntries.length > 0 ? (
            <ChartPaletteSelector
              selectedColors={customizations.color_palette_colors ?? null}
              onSelect={(colors) =>
                updateCustomization({
                  color_palette_colors: colors,
                  chart_color: undefined,
                })
              }
              disabled={disabled}
            />
          ) : (
            <ChartColorSwatchGrid
              selectedSolid={customizations.chart_color ?? undefined}
              onSelect={(color) =>
                updateCustomization({
                  chart_color: color.solid || null,
                  color_palette_colors: undefined,
                })
              }
              disabled={disabled}
            />
          )}

          <ChartNamedColorRows
            entries={dimensionColorEntries}
            selectedColors={dimensionColors}
            onChange={updateDimensionColor}
            disabled={disabled}
            fallbackColors={customizations.color_palette_colors}
            title="Dimension / Series Colors"
            description="Override specific series while the remaining lines keep using the selected palette."
          />
        </div>
      </div>
    </div>
  );
}
