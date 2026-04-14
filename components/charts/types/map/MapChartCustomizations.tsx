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
import { cn } from '@/lib/utils';
import { PRESET_CHART_PALETTES, blendWithWhite } from '@/constants/chart-palettes';

interface MapChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
}

export function MapChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: MapChartCustomizationsProps) {
  return (
    <div className="space-y-6">
      {/* Color and Styling */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Color and Styling</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Label className="text-sm font-medium">Map Color</Label>

          {/* Selected color preview — gradient from computed light to solid */}
          {customizations.map_color_solid && (
            <div className="flex items-center gap-3 p-2 border rounded-lg bg-gray-50">
              <div
                className="w-24 h-6 rounded"
                style={{
                  background: `linear-gradient(to right, ${blendWithWhite(customizations.map_color_solid)}, ${customizations.map_color_solid})`,
                }}
              />
              <span className="text-xs text-muted-foreground">Selected range</span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => updateCustomization('map_color_solid', null)}
                className="ml-auto text-xs text-muted-foreground underline hover:text-foreground disabled:cursor-not-allowed"
                data-testid="map-color-reset"
              >
                Reset
              </button>
            </div>
          )}

          {/* Palette-grouped solid color swatches */}
          <div className="space-y-3">
            {PRESET_CHART_PALETTES.map((palette) => (
              <div key={palette.name} className="space-y-1.5">
                <span className="text-xs text-muted-foreground">{palette.name}</span>
                <div className="flex gap-1.5 flex-wrap">
                  {palette.colors.map((color) => (
                    <button
                      key={color.solid}
                      type="button"
                      disabled={disabled}
                      onClick={() => updateCustomization('map_color_solid', color.solid)}
                      className={cn(
                        'w-6 h-6 rounded border-2 transition-all hover:scale-110 disabled:cursor-not-allowed disabled:opacity-50',
                        customizations.map_color_solid === color.solid
                          ? 'border-blue-500 ring-2 ring-blue-200 scale-110'
                          : 'border-transparent hover:border-gray-300'
                      )}
                      style={{ backgroundColor: color.solid }}
                      title={color.solid}
                      data-testid={`map-color-${color.solid.replace('#', '')}`}
                    />
                  ))}
                </div>
              </div>
            ))}
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
              disabled={disabled}
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
              disabled={disabled}
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
              disabled={disabled}
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
              placeholder="No Data"
              disabled={disabled}
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
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top-left">Top Left</SelectItem>
                <SelectItem value="top-right">Top Right</SelectItem>
                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                <SelectItem value="bottom-right">Bottom Right</SelectItem>
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
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>

      {/* Animation & Effects */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Animation & Effects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Border Width</Label>
            <p className="text-xs text-muted-foreground mb-2">Width of region borders</p>
            <Select
              value={customizations.borderWidth?.toString() || '1'}
              onValueChange={(value) => updateCustomization('borderWidth', parseInt(value))}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">No Border</SelectItem>
                <SelectItem value="1">Thin</SelectItem>
                <SelectItem value="2">Medium</SelectItem>
                <SelectItem value="3">Thick</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium">Border Color</Label>
            <Select
              value={customizations.borderColor || '#333'}
              onValueChange={(value) => updateCustomization('borderColor', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="#333">Dark Gray</SelectItem>
                <SelectItem value="#666">Medium Gray</SelectItem>
                <SelectItem value="#999">Light Gray</SelectItem>
                <SelectItem value="#fff">White</SelectItem>
                <SelectItem value="#000">Black</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Animation</Label>
              <p className="text-xs text-muted-foreground">Enable smooth transitions</p>
            </div>
            <Switch
              checked={customizations.animation !== false}
              onCheckedChange={(checked) => updateCustomization('animation', checked)}
              disabled={disabled}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
