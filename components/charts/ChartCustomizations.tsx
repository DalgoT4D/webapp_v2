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

        {hasExtraDimension && (
          <div className="flex items-center space-x-2">
            <Switch
              id="showLegend"
              checked={customizations.showLegend !== false}
              onCheckedChange={(checked) => updateCustomization('showLegend', checked)}
              disabled={disabled}
            />
            <Label htmlFor="showLegend">Show Legend</Label>
          </div>
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
      <div className="space-y-2">
        <Label>Chart Style</Label>
        <RadioGroup
          value={customizations.chartStyle || 'pie'}
          onValueChange={(value) => updateCustomization('chartStyle', value)}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="pie" id="pie" />
            <Label htmlFor="pie">Full Pie</Label>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="donut" id="donut" />
            <Label htmlFor="donut">Donut Chart</Label>
          </div>
        </RadioGroup>
      </div>

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
      )}

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
              <SelectItem value="right">Right</SelectItem>
              <SelectItem value="bottom">Bottom</SelectItem>
              <SelectItem value="left">Left</SelectItem>
              <SelectItem value="top">Top</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
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
      <div className="space-y-2">
        <Label>Line Style</Label>
        <RadioGroup
          value={customizations.lineStyle || 'straight'}
          onValueChange={(value) => updateCustomization('lineStyle', value)}
          disabled={disabled}
        >
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="straight" id="straight" />
            <Label htmlFor="straight">Straight Lines</Label>
          </div>
          <div className="flex items-center space-x-2 mt-2">
            <RadioGroupItem value="smooth" id="smooth" />
            <Label htmlFor="smooth">Smooth Curves</Label>
          </div>
        </RadioGroup>
      </div>

      <div className="flex items-center space-x-2">
        <Switch
          id="showDataLabels"
          checked={customizations.showDataLabels || false}
          onCheckedChange={(checked) => updateCustomization('showDataLabels', checked)}
          disabled={disabled}
        />
        <Label htmlFor="showDataLabels">Show Data Labels</Label>
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
        <Label htmlFor="yAxisTitle">Y-Axis Title</Label>
        <Input
          id="yAxisTitle"
          value={customizations.yAxisTitle || ''}
          onChange={(e) => updateCustomization('yAxisTitle', e.target.value)}
          placeholder="Enter Y-axis title"
          disabled={disabled}
        />
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
      </div>
    </div>
  );
}
