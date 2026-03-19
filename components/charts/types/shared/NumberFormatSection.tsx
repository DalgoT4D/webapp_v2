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
import type { NumberFormat } from '@/lib/formatters';

/**
 * Format options available for number formatting
 * Labels include examples showing transformation: 1234567 => formatted value
 */
export const NUMBER_FORMAT_OPTIONS = [
  { value: 'default', label: 'No Formatting' },
  { value: 'adaptive_indian', label: 'Adaptive Indian (1234567 => 12.35L)' },
  { value: 'adaptive_international', label: 'Adaptive International (1234567 => 1.23M)' },
  { value: 'indian', label: 'Indian (1234567 => 12,34,567)' },
  { value: 'international', label: 'International (1234567 => 1,234,567)' },
  { value: 'european', label: 'European (1234567 => 1.234.567)' },
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'currency', label: 'Currency ($)' },
] as const;

/**
 * Format options for table charts (excludes percentage and currency)
 */
export const TABLE_NUMBER_FORMAT_OPTIONS = NUMBER_FORMAT_OPTIONS.filter(
  (opt) => opt.value !== 'percentage' && opt.value !== 'currency'
);

interface NumberFormatSectionProps {
  /**
   * Unique prefix for element IDs (e.g., 'yAxis', 'xAxis', 'pie')
   * Will generate IDs like: yAxisNumberFormat, yAxisDecimalPlaces
   */
  idPrefix: string;
  /**
   * Current number format value
   */
  numberFormat: NumberFormat | undefined;
  /**
   * Current decimal places value
   */
  decimalPlaces: number | undefined;
  /**
   * Callback when number format changes
   */
  onNumberFormatChange: (value: NumberFormat) => void;
  /**
   * Callback when decimal places changes
   */
  onDecimalPlacesChange: (value: number) => void;
  /**
   * Whether the controls are disabled
   */
  disabled?: boolean;
  /**
   * Whether to show description text under number format dropdown
   */
  showDescription?: boolean;
  /**
   * Custom description text (only shown if showDescription is true)
   */
  description?: string;
  /**
   * Format values to exclude from the dropdown (e.g., ['percentage', 'currency'] for table charts)
   */
  excludeFormats?: string[];
}

/**
 * Reusable component for number format dropdown and decimal places input.
 * Used by Line, Bar, Pie,Table and Number chart customization panels.
 */
export function NumberFormatSection({
  idPrefix,
  numberFormat,
  decimalPlaces,
  onNumberFormatChange,
  onDecimalPlacesChange,
  disabled = false,
  showDescription = false,
  description = 'Applied to axis labels, data labels, and tooltips',
  excludeFormats = [],
}: NumberFormatSectionProps) {
  const handleDecimalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
    onDecimalPlacesChange(value);
  };

  // Filter out excluded formats
  const availableOptions = NUMBER_FORMAT_OPTIONS.filter(
    (opt) => !excludeFormats.includes(opt.value)
  );

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}NumberFormat`}>Number Format</Label>
        <Select
          value={numberFormat || 'default'}
          onValueChange={(value) => onNumberFormatChange(value as NumberFormat)}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}NumberFormat`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showDescription && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}DecimalPlaces`}>Decimal Places</Label>
        <Input
          id={`${idPrefix}DecimalPlaces`}
          type="number"
          min={0}
          max={10}
          value={decimalPlaces ?? 0}
          onChange={handleDecimalChange}
          disabled={disabled}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground">Number of digits after decimal point (0-10)</p>
      </div>
    </>
  );
}
