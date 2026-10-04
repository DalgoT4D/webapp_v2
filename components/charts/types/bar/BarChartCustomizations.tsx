'use client';

import { Label } from '@/components/ui/label';
import { DebouncedInput } from '@/components/charts/debounced-input';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NumberFormat, DateFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../shared/NumberFormatSection';
import { DateFormatSection } from '../shared/DateFormatSection';

interface BarChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  hasExtraDimension?: boolean;
  hasNumericXAxis?: boolean;
  hasDateXAxis?: boolean;
}

export function BarChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasExtraDimension,
  hasNumericXAxis = false,
  hasDateXAxis = false,
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
              <RadioGroupItem
                value="vertical"
                id="vertical"
                data-testid="chart-styling-orientation-vertical"
              />
              <Label htmlFor="vertical">Vertical</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem
                value="horizontal"
                id="horizontal"
                data-testid="chart-styling-orientation-horizontal"
              />
              <Label htmlFor="horizontal">Horizontal</Label>
            </div>
          </RadioGroup>
        </div>

        {hasExtraDimension && (
          <div className="flex items-center space-x-2">
            <Switch
              id="stacked"
              data-testid="chart-styling-stacked"
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
            data-testid="chart-styling-show-tooltip"
            checked={customizations.showTooltip !== false}
            onCheckedChange={(checked) => updateCustomization('showTooltip', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showTooltip">Show Tooltip on Hover</Label>
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="showLegend"
            data-testid="chart-styling-show-legend"
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
                  <RadioGroupItem
                    value="paginated"
                    id="bar-paginated"
                    data-testid="chart-styling-legend-display-paginated"
                  />
                  <Label htmlFor="bar-paginated">Paginated Legends</Label>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem
                    value="all"
                    id="bar-all"
                    data-testid="chart-styling-legend-display-all"
                  />
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
                <SelectTrigger id="barLegendPosition" data-testid="chart-styling-legend-position">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="top" data-testid="chart-styling-legend-position-option-top">
                    Top
                  </SelectItem>
                  <SelectItem
                    value="bottom"
                    data-testid="chart-styling-legend-position-option-bottom"
                  >
                    Bottom
                  </SelectItem>
                  <SelectItem value="left" data-testid="chart-styling-legend-position-option-left">
                    Left
                  </SelectItem>
                  <SelectItem
                    value="right"
                    data-testid="chart-styling-legend-position-option-right"
                  >
                    Right
                  </SelectItem>
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
            data-testid="chart-styling-show-data-labels"
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
              <SelectTrigger id="dataLabelPosition" data-testid="chart-styling-data-label-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top" data-testid="chart-styling-data-label-position-option-top">
                  Top
                </SelectItem>
                <SelectItem
                  value="inside"
                  data-testid="chart-styling-data-label-position-option-inside"
                >
                  Middle
                </SelectItem>
                <SelectItem
                  value="insideBottom"
                  data-testid="chart-styling-data-label-position-option-insideBottom"
                >
                  Bottom
                </SelectItem>
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
          <DebouncedInput
            id="xAxisTitle"
            data-testid="chart-styling-x-axis-title"
            value={customizations.xAxisTitle || ''}
            onChange={(value) => updateCustomization('xAxisTitle', value)}
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
            <SelectTrigger
              id="xAxisLabelRotation"
              data-testid="chart-styling-x-axis-label-rotation"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="horizontal"
                data-testid="chart-styling-x-axis-label-rotation-option-horizontal"
              >
                Horizontal (0°)
              </SelectItem>
              <SelectItem value="45" data-testid="chart-styling-x-axis-label-rotation-option-45">
                45 degrees
              </SelectItem>
              <SelectItem
                value="vertical"
                data-testid="chart-styling-x-axis-label-rotation-option-vertical"
              >
                Vertical (90°)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* X-Axis Number Formatting - only shown for numeric X-axis */}
        {hasNumericXAxis && (
          <NumberFormatSection
            idPrefix="xAxis"
            numberFormat={customizations.xAxisNumberFormat as NumberFormat}
            decimalPlaces={customizations.xAxisDecimalPlaces}
            onNumberFormatChange={(value) => updateCustomization('xAxisNumberFormat', value)}
            onDecimalPlacesChange={(value) => updateCustomization('xAxisDecimalPlaces', value)}
            disabled={disabled}
          />
        )}

        {/* X-Axis Date Formatting - only shown for date X-axis */}
        {hasDateXAxis && (
          <DateFormatSection
            idPrefix="xAxis"
            dateFormat={customizations.xAxisDateFormat as DateFormat}
            onDateFormatChange={(value) => updateCustomization('xAxisDateFormat', value)}
            disabled={disabled}
          />
        )}
      </div>

      {/* Y-Axis Configuration */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Y-Axis</h4>

        <div className="space-y-2">
          <Label htmlFor="yAxisTitle">Title</Label>
          <DebouncedInput
            id="yAxisTitle"
            data-testid="chart-styling-y-axis-title"
            value={customizations.yAxisTitle || ''}
            onChange={(value) => updateCustomization('yAxisTitle', value)}
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
            <SelectTrigger
              id="yAxisLabelRotation"
              data-testid="chart-styling-y-axis-label-rotation"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="horizontal"
                data-testid="chart-styling-y-axis-label-rotation-option-horizontal"
              >
                Horizontal (0°)
              </SelectItem>
              <SelectItem value="45" data-testid="chart-styling-y-axis-label-rotation-option-45">
                45 degrees
              </SelectItem>
              <SelectItem
                value="vertical"
                data-testid="chart-styling-y-axis-label-rotation-option-vertical"
              >
                Vertical (90°)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <NumberFormatSection
          idPrefix="yAxis"
          numberFormat={customizations.yAxisNumberFormat as NumberFormat}
          decimalPlaces={customizations.yAxisDecimalPlaces}
          onNumberFormatChange={(value) => updateCustomization('yAxisNumberFormat', value)}
          onDecimalPlacesChange={(value) => updateCustomization('yAxisDecimalPlaces', value)}
          disabled={disabled}
          showDescription={true}
          description="Applied to Y-axis labels, data labels, and tooltips"
        />
      </div>
    </div>
  );
}
