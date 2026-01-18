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
import type { ChartBuilderFormData } from '@/types/charts';

interface ChartCustomizationsProps {
  chartType: string;
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

export function ChartCustomizations({
  chartType,
  formData,
  onChange,
  disabled,
}: ChartCustomizationsProps) {
  // Safety check for undefined formData
  if (!formData) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Please configure chart data first</p>
      </div>
    );
  }

  const customizations = formData.customizations || {};

  const updateCustomization = (key: string, value: any) => {
    onChange({
      customizations: {
        ...customizations,
        [key]: value,
      },
    });
  };

  if (chartType === 'bar') {
    return (
      <BarChartCustomizations
        customizations={customizations}
        updateCustomization={updateCustomization}
        disabled={disabled}
        hasExtraDimension={!!formData.extra_dimension_column}
      />
    );
  }

  if (chartType === 'pie') {
    return (
      <PieChartCustomizations
        customizations={customizations}
        updateCustomization={updateCustomization}
        disabled={disabled}
      />
    );
  }

  if (chartType === 'line') {
    return (
      <LineChartCustomizations
        customizations={customizations}
        updateCustomization={updateCustomization}
        disabled={disabled}
      />
    );
  }

  if (chartType === 'number') {
    return (
      <NumberChartCustomizations
        customizations={customizations}
        updateCustomization={updateCustomization}
        disabled={disabled}
      />
    );
  }

  if (chartType === 'map') {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Configuration for map charts coming soon</p>
      </div>
    );
  }

  return null;
}

interface CustomizationProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  hasExtraDimension?: boolean;
}

function BarChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasExtraDimension,
}: CustomizationProps) {
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
                <SelectItem value="middle">Middle</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
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
    </div>
  );
}

function PieChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: CustomizationProps) {
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
                  if (!customizations.legendPosition) {
                    updateCustomization('legendPosition', 'right');
                  }
                  updateCustomization('legendDisplay', value);
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

function LineChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: CustomizationProps) {
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
                  if (!customizations.legendPosition) {
                    updateCustomization('legendPosition', 'right');
                  }
                  updateCustomization('legendDisplay', value);
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
    </div>
  );
}

function NumberChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: CustomizationProps) {
  return (
    <div className="space-y-6">
      {/* Display Options */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Display Options</h4>

        <div className="space-y-2">
          <Label>Number Size</Label>
          <RadioGroup
            value={customizations.numberSize || 'medium'}
            onValueChange={(value) => updateCustomization('numberSize', value)}
            disabled={disabled}
          >
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="small" id="small" />
              <Label htmlFor="small">Small</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="medium" id="medium" />
              <Label htmlFor="medium">Medium</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem value="large" id="large" />
              <Label htmlFor="large">Large</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-2">
          <Label htmlFor="subtitle">Subtitle</Label>
          <Input
            id="subtitle"
            value={customizations.subtitle || ''}
            onChange={(e) => updateCustomization('subtitle', e.target.value)}
            placeholder="Enter subtitle text (appears below the number)"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            This text will appear below the main metric value
          </p>
        </div>
      </div>

      {/* Number Formatting */}
      <div className="space-y-4 pb-4 border-b">
        <h4 className="text-sm font-medium">Number Formatting</h4>

        <div className="space-y-2">
          <Label htmlFor="numberFormat">Number Format</Label>
          <Select
            value={customizations.numberFormat || 'default'}
            onValueChange={(value) => updateCustomization('numberFormat', value)}
            disabled={disabled}
          >
            <SelectTrigger id="numberFormat">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="comma">Comma Separated (1,234)</SelectItem>
              <SelectItem value="percentage">Percentage (%)</SelectItem>
              <SelectItem value="currency">Currency ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="decimalPlaces">Decimal Places</Label>
          <Input
            id="decimalPlaces"
            type="number"
            min="0"
            max="10"
            value={customizations.decimalPlaces || 0}
            onChange={(e) => updateCustomization('decimalPlaces', parseInt(e.target.value) || 0)}
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">
            Number of digits after decimal point (0-10)
          </p>
        </div>
      </div>

      {/* Prefix and Suffix */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Prefix & Suffix</h4>

        <div className="space-y-2">
          <Label htmlFor="numberPrefix">Prefix</Label>
          <Input
            id="numberPrefix"
            value={customizations.numberPrefix || ''}
            onChange={(e) => updateCustomization('numberPrefix', e.target.value)}
            placeholder="Text before number (e.g., $, +, -)"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Text that appears before the number</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="numberSuffix">Suffix</Label>
          <Input
            id="numberSuffix"
            value={customizations.numberSuffix || ''}
            onChange={(e) => updateCustomization('numberSuffix', e.target.value)}
            placeholder="Text after number (e.g., %, K, M, units)"
            disabled={disabled}
          />
          <p className="text-xs text-muted-foreground">Text that appears after the number</p>
        </div>
      </div>
    </div>
  );
}
