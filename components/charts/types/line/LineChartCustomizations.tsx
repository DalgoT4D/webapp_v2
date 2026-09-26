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

interface LineChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  hasNumericXAxis?: boolean;
  hasDateXAxis?: boolean;
}

export function LineChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  hasNumericXAxis = false,
  hasDateXAxis = false,
}: LineChartCustomizationsProps) {
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
              <RadioGroupItem
                value="smooth"
                id="smooth"
                data-testid="chart-styling-line-style-smooth"
              />
              <Label htmlFor="smooth">Smooth Curves</Label>
            </div>
            <div className="flex items-center space-x-2 mt-2">
              <RadioGroupItem
                value="straight"
                id="straight"
                data-testid="chart-styling-line-style-straight"
              />
              <Label htmlFor="straight">Straight Lines</Label>
            </div>
          </RadioGroup>
        </div>

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
            id="showDataPoints"
            data-testid="chart-styling-show-data-points"
            checked={customizations.showDataPoints !== false}
            onCheckedChange={(checked) => updateCustomization('showDataPoints', checked)}
            disabled={disabled}
          />
          <Label htmlFor="showDataPoints">Show Data Points</Label>
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
                    id="line-paginated"
                    data-testid="chart-styling-legend-display-paginated"
                  />
                  <Label htmlFor="line-paginated">Paginated Legends</Label>
                </div>
                <div className="flex items-center space-x-2 mt-2">
                  <RadioGroupItem
                    value="all"
                    id="line-all"
                    data-testid="chart-styling-legend-display-all"
                  />
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
                <SelectTrigger id="lineLegendPosition" data-testid="chart-styling-legend-position">
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
                  Above Point
                </SelectItem>
                <SelectItem
                  value="bottom"
                  data-testid="chart-styling-data-label-position-option-bottom"
                >
                  Below Point
                </SelectItem>
                <SelectItem
                  value="left"
                  data-testid="chart-styling-data-label-position-option-left"
                >
                  Left of Point
                </SelectItem>
                <SelectItem
                  value="right"
                  data-testid="chart-styling-data-label-position-option-right"
                >
                  Right of Point
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
