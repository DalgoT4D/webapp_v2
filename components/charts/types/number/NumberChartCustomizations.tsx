'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { NumberFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../shared/NumberFormatSection';

interface NumberChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
}

export function NumberChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
}: NumberChartCustomizationsProps) {
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

        <NumberFormatSection
          idPrefix="number"
          numberFormat={customizations.numberFormat as NumberFormat}
          decimalPlaces={customizations.decimalPlaces}
          onNumberFormatChange={(value) => updateCustomization('numberFormat', value)}
          onDecimalPlacesChange={(value) => updateCustomization('decimalPlaces', value)}
          disabled={disabled}
        />
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
