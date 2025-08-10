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

interface MapCustomizationsProps {
  formData: any;
  onFormDataChange: (data: any) => void;
}

export function MapCustomizations({ formData, onFormDataChange }: MapCustomizationsProps) {
  const customizations = formData.customizations || {};

  const updateCustomization = (key: string, value: any) => {
    onFormDataChange({
      ...formData,
      customizations: {
        ...customizations,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Chart Title */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Chart Title</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Title</Label>
            <Input
              value={customizations.title || ''}
              onChange={(e) => updateCustomization('title', e.target.value)}
              placeholder="Enter chart title"
            />
          </div>
        </CardContent>
      </Card>

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
              value={customizations.nullValueLabel || 'No Data'}
              onChange={(e) => updateCustomization('nullValueLabel', e.target.value)}
              placeholder="No Data"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
