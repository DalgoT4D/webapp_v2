'use client';

import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChartPaletteSelector } from '../../ChartPaletteSelector';
import { ChartNamedColorRows } from '../../ChartNamedColorRows';
import { getChartNamedColorEntries, getDimensionColorMap } from '@/lib/chart-color-customizations';

interface PieChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (keyOrUpdates: string | Record<string, any>, value?: any) => void;
  disabled?: boolean;
  chartConfig?: Record<string, any>;
}

export function PieChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  chartConfig,
}: PieChartCustomizationsProps) {
  const dimensionColors = getDimensionColorMap(customizations);
  const dimensionColorEntries = getChartNamedColorEntries({
    chartType: 'pie',
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
      {/* Legend */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Legend</h4>

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
                  <RadioGroupItem value="paginated" id="paginated" />
                  <Label htmlFor="paginated">Paginated Legends</Label>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all">Show All Legends in Chart Area</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label htmlFor="legendPosition">Legend Position</Label>
              <Select
                value={customizations.legendPosition || 'right'}
                onValueChange={(value) => updateCustomization('legendPosition', value)}
                disabled={disabled}
              >
                <SelectTrigger id="legendPosition">
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

      {/* Basic Display Options */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Display Options</h4>

        <div className="space-y-2">
          <Label>Chart Style</Label>
          <RadioGroup
            value={customizations.chartStyle || 'donut'}
            onValueChange={(value) => updateCustomization('chartStyle', value)}
            disabled={disabled}
          >
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="donut" id="donut" />
              <Label htmlFor="donut">Donut Chart</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="pie" id="pie" />
              <Label htmlFor="pie">Full Pie</Label>
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
      </div>

      {/* Slice Configuration */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Slice Configuration</h4>

        <div className="space-y-2">
          <Label htmlFor="maxSlices">Slice Limit</Label>
          <Select
            value={customizations.maxSlices ? customizations.maxSlices.toString() : 'all'}
            onValueChange={(value) => {
              updateCustomization('maxSlices', value === 'all' ? null : parseInt(value));
            }}
            disabled={disabled}
          >
            <SelectTrigger id="maxSlices">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Show All Slices</SelectItem>
              <SelectItem value="3">Top 3 Slices</SelectItem>
              <SelectItem value="5">Top 5 Slices</SelectItem>
              <SelectItem value="10">Top 10 Slices</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            When limited, remaining slices will be grouped under "Other" category.
          </p>
        </div>
      </div>

      {/* Colors */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Colors</h4>
        <div className="space-y-4">
          <ChartPaletteSelector
            selectedColors={customizations.color_palette_colors ?? null}
            onSelect={(colors) => updateCustomization('color_palette_colors', colors)}
            disabled={disabled}
          />

          <ChartNamedColorRows
            entries={dimensionColorEntries}
            selectedColors={dimensionColors}
            onChange={updateDimensionColor}
            disabled={disabled}
            fallbackColors={customizations.color_palette_colors}
            title="Slice Colors"
            description="Override specific slices while the remaining slices keep using the selected palette."
          />
        </div>
      </div>

      {/* Data Labels */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Data Labels</h4>

        <div className="flex items-center space-x-2">
          <Switch
            id="showDataLabels"
            checked={customizations.showDataLabels !== false}
            onCheckedChange={(checked) => updateCustomization('showDataLabels', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showDataLabels">Show Data Labels</Label>
        </div>

        {customizations.showDataLabels !== false && (
          <>
            <div className="space-y-2">
              <Label htmlFor="labelFormat">Label Format</Label>
              <Select
                value={customizations.labelFormat || 'percentage'}
                onValueChange={(value) => updateCustomization('labelFormat', value)}
                disabled={disabled}
              >
                <SelectTrigger id="labelFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage only</SelectItem>
                  <SelectItem value="value">Value only</SelectItem>
                  <SelectItem value="name_percentage">Name + Percentage</SelectItem>
                  <SelectItem value="name_value">Name + Value</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dataLabelPosition">Label Position</Label>
              <Select
                value={customizations.dataLabelPosition || 'outside'}
                onValueChange={(value) => updateCustomization('dataLabelPosition', value)}
                disabled={disabled}
              >
                <SelectTrigger id="dataLabelPosition">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="outside">Outside (Top)</SelectItem>
                  <SelectItem value="inside">Inside (Mid)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
