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
import { NumberFormats, MAX_DECIMAL_PLACES, type NumberFormat } from '@/lib/formatters';

/**
 * Format options available for number formatting
 * Labels include examples showing transformation: 1234567 => formatted value
 */
export const NUMBER_FORMAT_OPTIONS = [
  { value: NumberFormats.DEFAULT, label: 'No Formatting' },
  { value: NumberFormats.ADAPTIVE_INDIAN, label: 'Adaptive Indian (1234567 => 12.35L)' },
  {
    value: NumberFormats.ADAPTIVE_INTERNATIONAL,
    label: 'Adaptive International (1234567 => 1.23M)',
  },
  { value: NumberFormats.INDIAN, label: 'Indian (1234567 => 12,34,567)' },
  { value: NumberFormats.INTERNATIONAL, label: 'International (1234567 => 1,234,567)' },
  { value: NumberFormats.EUROPEAN, label: 'European (1234567 => 1.234.567)' },
  { value: NumberFormats.PERCENTAGE, label: 'Percentage (0.85 => 85.00%)' },
] as const;

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
}

/**
 * Reusable component for number format dropdown and decimal places input.
 * Used by Line, Bar, Pie, Table, Number chart customization panels and the KPI form.
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
}: NumberFormatSectionProps) {
  const handleDecimalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(MAX_DECIMAL_PLACES, Math.max(0, parseInt(e.target.value) || 0));
    onDecimalPlacesChange(value);
  };

  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}NumberFormat`}>Number Format</Label>
        <Select
          value={numberFormat || NumberFormats.DEFAULT}
          onValueChange={(value) => onNumberFormatChange(value as NumberFormat)}
          disabled={disabled}
        >
          <SelectTrigger id={`${idPrefix}NumberFormat`} data-testid={`${idPrefix}NumberFormat`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {NUMBER_FORMAT_OPTIONS.map((opt) => (
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
          data-testid={`${idPrefix}DecimalPlaces`}
          type="number"
          min={0}
          max={MAX_DECIMAL_PLACES}
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
