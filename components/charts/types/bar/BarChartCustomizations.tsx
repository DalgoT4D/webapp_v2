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
import type { NumberFormat } from '@/lib/formatters';

interface BarChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  hasExtraDimension?: boolean;
  hasNumericXAxis?: boolean;
}

export function BarChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasExtraDimension,
  hasNumericXAxis = false,
}: BarChartCustomizationsProps) {
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
                  if (!customizations.legendPosition) {
                    updateCustomization('legendPosition', 'right');
                  }
                  updateCustomization('legendDisplay', value);
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

      {/* X-Axis Configuration */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">X-Axis</h4>

        <div className="space-y-2">
          <Label htmlFor="xAxisTitle">Title</Label>
          <Input
            id="xAxisTitle"
            value={customizations.xAxisTitle || ''}
            onChange={(e) => updateCustomization('xAxisTitle', e.target.value)}
            placeholder="Enter X-axis title"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="xAxisLabelRotation">Label Rotation</Label>
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

        {/* X-Axis Number Formatting - only shown for numeric X-axis */}
        {hasNumericXAxis && (
          <>
            <div className="space-y-2">
              <Label htmlFor="xAxisNumberFormat">Number Format</Label>
              <Select
                value={(customizations.xAxisNumberFormat as NumberFormat) || 'default'}
                onValueChange={(value) => updateCustomization('xAxisNumberFormat', value)}
                disabled={disabled}
              >
                <SelectTrigger id="xAxisNumberFormat">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">No Formatting</SelectItem>
                  <SelectItem value="adaptive_indian">Adaptive Indian (12.35L)</SelectItem>
                  <SelectItem value="adaptive_international">
                    Adaptive International (1.23M)
                  </SelectItem>
                  <SelectItem value="indian">Indian (12,34,567)</SelectItem>
                  <SelectItem value="international">International (1,234,567)</SelectItem>
                  <SelectItem value="european">European (1.234.567)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="currency">Currency ($)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="xAxisDecimalPlaces">Decimal Places</Label>
              <Input
                id="xAxisDecimalPlaces"
                type="number"
                min={0}
                max={10}
                value={customizations.xAxisDecimalPlaces ?? 0}
                onChange={(e) => {
                  const value = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                  updateCustomization('xAxisDecimalPlaces', value);
                }}
                disabled={disabled}
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">
                Number of digits after decimal point (0-10)
              </p>
            </div>
          </>
        )}
      </div>

      {/* Y-Axis Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Y-Axis</h4>

        <div className="space-y-2">
          <Label htmlFor="yAxisTitle">Title</Label>
          <Input
            id="yAxisTitle"
            value={customizations.yAxisTitle || ''}
            onChange={(e) => updateCustomization('yAxisTitle', e.target.value)}
            placeholder="Enter Y-axis title"
            disabled={disabled}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="yAxisLabelRotation">Label Rotation</Label>
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

        <div className="space-y-2">
          <Label htmlFor="yAxisNumberFormat">Number Format</Label>
          <Select
            value={(customizations.yAxisNumberFormat as NumberFormat) || 'default'}
            onValueChange={(value) => updateCustomization('yAxisNumberFormat', value)}
            disabled={disabled}
          >
            <SelectTrigger id="yAxisNumberFormat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">No Formatting</SelectItem>
              <SelectItem value="adaptive_indian">Adaptive Indian (12.35L)</SelectItem>
              <SelectItem value="adaptive_international">Adaptive International (1.23M)</SelectItem>
              <SelectItem value="indian">Indian (12,34,567)</SelectItem>
              <SelectItem value="international">International (1,234,567)</SelectItem>
              <SelectItem value="european">European (1.234.567)</SelectItem>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="currency">Currency ($)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Applied to Y-axis labels, data labels, and tooltips
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="yAxisDecimalPlaces">Decimal Places</Label>
          <Input
            id="yAxisDecimalPlaces"
            type="number"
            min={0}
            max={10}
            value={customizations.yAxisDecimalPlaces ?? 0}
            onChange={(e) => {
              const value = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
              updateCustomization('yAxisDecimalPlaces', value);
            }}
            disabled={disabled}
            className="w-full"
          />
          <p className="text-xs text-muted-foreground">
            Number of digits after decimal point (0-10)
          </p>
        </div>
      </div>
    </div>
  );
}
