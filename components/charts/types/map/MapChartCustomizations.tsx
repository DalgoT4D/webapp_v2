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
          <div>
            <Label className="text-sm font-medium">Color Scheme</Label>
            <Select
              value={customizations.colorScheme || 'Blues'}
              onValueChange={(value) => updateCustomization('colorScheme', value)}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Blues">Blues</SelectItem>
                <SelectItem value="Reds">Reds</SelectItem>
                <SelectItem value="Greens">Greens</SelectItem>
                <SelectItem value="Purples">Purples</SelectItem>
                <SelectItem value="Oranges">Oranges</SelectItem>
                <SelectItem value="Greys">Greys</SelectItem>
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
