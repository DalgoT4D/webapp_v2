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
import type { ChartCreate } from '@/types/charts';

interface ChartCustomizationsProps {
  chartType: string;
  formData: Partial<ChartCreate>;
  onChange: (updates: Partial<ChartCreate>) => void;
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

  if (chartType === 'number' || chartType === 'map') {
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Configuration for {chartType} charts coming soon</p>
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
          id="showDataLabels"
          checked={customizations.showDataLabels || false}
          onCheckedChange={(checked) => updateCustomization('showDataLabels', checked)}
          disabled={disabled}
        />
        <Label htmlFor="showDataLabels">Show Data Labels</Label>
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
