'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { NumberFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../types/shared/NumberFormatSection';

interface MapCustomizationsProps {
  formData: any;
  onFormDataChange: (data: any) => void;
}

export function MapCustomizations({ formData, onFormDataChange }: MapCustomizationsProps) {
  const customizations = formData.customizations || {};

  const updateCustomization = (key: string, value: any) => {
    const newCustomizations = {
      ...customizations,
      [key]: value,
    };

    onFormDataChange({
      ...formData,
      customizations: newCustomizations,
    });
  };

  return (
    <div className="space-y-6">
      {/* Color and Styling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Color and Styling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Color Scheme</Label>
            <Select
              value={customizations.colorScheme || 'Blues'}
              onValueChange={(value) => updateCustomization('colorScheme', value)}
            >
              <SelectTrigger data-testid="chart-styling-color-scheme">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Blues" data-testid="chart-styling-color-scheme-option-Blues">
                  Blues
                </SelectItem>
                <SelectItem value="Reds" data-testid="chart-styling-color-scheme-option-Reds">
                  Reds
                </SelectItem>
                <SelectItem value="Greens" data-testid="chart-styling-color-scheme-option-Greens">
                  Greens
                </SelectItem>
                <SelectItem value="Purples" data-testid="chart-styling-color-scheme-option-Purples">
                  Purples
                </SelectItem>
                <SelectItem value="Oranges" data-testid="chart-styling-color-scheme-option-Oranges">
                  Oranges
                </SelectItem>
                <SelectItem value="Greys" data-testid="chart-styling-color-scheme-option-Greys">
                  Greys
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Interactive Features */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Interactive Features</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Tooltip</Label>
              <p className="text-xs text-muted-foreground">Display values on hover</p>
            </div>
            <Switch
              checked={customizations.showTooltip !== false}
              onCheckedChange={(checked) => updateCustomization('showTooltip', checked)}
              data-testid="chart-styling-show-tooltip"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Legend</Label>
              <p className="text-xs text-muted-foreground">Display color scale legend</p>
            </div>
            <Switch
              checked={customizations.showLegend !== false}
              onCheckedChange={(checked) => updateCustomization('showLegend', checked)}
              data-testid="chart-styling-show-legend"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Enable Selection</Label>
              <p className="text-xs text-muted-foreground">Allow clicking to select regions</p>
            </div>
            <Switch
              checked={customizations.select !== false}
              onCheckedChange={(checked) => updateCustomization('select', checked)}
              data-testid="chart-styling-enable-selection"
            />
          </div>
        </CardContent>
      </Card>

      {/* Data Handling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Handling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <NumberFormatSection
            idPrefix="map"
            numberFormat={customizations.numberFormat as NumberFormat}
            decimalPlaces={customizations.decimalPlaces}
            onNumberFormatChange={(value) => updateCustomization('numberFormat', value)}
            onDecimalPlacesChange={(value) => updateCustomization('decimalPlaces', value)}
          />

          <div>
            <Label className="text-sm font-medium">Label for No Data</Label>
            <p className="text-xs text-muted-foreground mb-2">
              Text to show for regions with no data
            </p>
            <Input
              value={
                customizations.nullValueLabel !== undefined
                  ? customizations.nullValueLabel
                  : 'No Data'
              }
              onChange={(e) => updateCustomization('nullValueLabel', e.target.value)}
              data-testid="chart-styling-null-value-label"
              placeholder="No Data"
            />
          </div>
        </CardContent>
      </Card>

      {/* Visual Elements */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Visual Elements</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Legend Position</Label>
            <Select
              value={(() => {
                const pos = customizations.legendPosition;
                // Normalize legacy values to new corner format
                const legacyMap: Record<string, string> = {
                  left: 'bottom-left',
                  right: 'bottom-right',
                  top: 'top-left',
                  bottom: 'bottom-left',
                };
                if (pos && legacyMap[pos]) return legacyMap[pos];
                if (pos && ['top-left', 'top-right', 'bottom-left', 'bottom-right'].includes(pos))
                  return pos;
                return 'bottom-left';
              })()}
              onValueChange={(value) => updateCustomization('legendPosition', value)}
            >
              <SelectTrigger data-testid="chart-styling-legend-position">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value="top-left"
                  data-testid="chart-styling-legend-position-option-top-left"
                >
                  Top Left
                </SelectItem>
                <SelectItem
                  value="top-right"
                  data-testid="chart-styling-legend-position-option-top-right"
                >
                  Top Right
                </SelectItem>
                <SelectItem
                  value="bottom-left"
                  data-testid="chart-styling-legend-position-option-bottom-left"
                >
                  Bottom Left
                </SelectItem>
                <SelectItem
                  value="bottom-right"
                  data-testid="chart-styling-legend-position-option-bottom-right"
                >
                  Bottom Right
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Show Region Names</Label>
              <p className="text-xs text-muted-foreground">Display region labels on the map</p>
            </div>
            <Switch
              checked={customizations.showLabels === true}
              onCheckedChange={(checked) => updateCustomization('showLabels', checked)}
              data-testid="chart-styling-show-region-names"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
