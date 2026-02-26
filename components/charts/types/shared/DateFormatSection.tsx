'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DateFormat } from '@/lib/formatters';

/**
 * Format options available for date formatting
 * Labels include examples showing transformation
 */
export const DATE_FORMAT_OPTIONS = [
  { value: 'default', label: 'No Formatting' },
  { value: 'iso_datetime', label: '%Y-%m-%d %H:%M:%S (2019-01-14 01:32:10)' },
  { value: 'dd_mm_yyyy', label: '%d/%m/%Y (14/01/2019)' },
  { value: 'mm_dd_yyyy', label: '%m/%d/%Y (01/14/2019)' },
  { value: 'yyyy_mm_dd', label: '%Y-%m-%d (2019-01-14)' },
  { value: 'dd_mm_yyyy_time', label: '%d-%m-%Y %H:%M:%S (14-01-2019 01:32:10)' },
  { value: 'time_only', label: '%H:%M:%S (01:32:10)' },
] as const;

interface DateFormatSectionProps {
  /**
   * Unique prefix for element IDs (e.g., 'table-column1', 'line-xAxis')
   * Will generate IDs like: table-column1DateFormat
   */
  idPrefix: string;
  /**
   * Current date format value
   */
  dateFormat: DateFormat | undefined;
  /**
   * Callback when date format changes
   */
  onDateFormatChange: (value: DateFormat) => void;
  /**
   * Whether the controls are disabled
   */
  disabled?: boolean;
  /**
   * Whether to show description text under date format dropdown
   */
  showDescription?: boolean;
  /**
   * Custom description text (only shown if showDescription is true)
   */
  description?: string;
  /**
   * Format values to exclude from the dropdown
   */
  excludeFormats?: string[];
}

/**
 * Reusable component for date format dropdown.
 * Used by Table chart customization panel for date/timestamp columns.
 */
export function DateFormatSection({
  idPrefix,
  dateFormat,
  onDateFormatChange,
  disabled = false,
  showDescription = false,
  description = 'Applied to date/timestamp columns',
  excludeFormats = [],
}: DateFormatSectionProps) {
  // Filter out excluded formats
  const availableOptions = DATE_FORMAT_OPTIONS.filter((opt) => !excludeFormats.includes(opt.value));

  return (
    <div className="space-y-2">
      <Label htmlFor={`${idPrefix}DateFormat`}>Date Format</Label>
      <Select
        value={dateFormat || 'default'}
        onValueChange={(value) => onDateFormatChange(value as DateFormat)}
        disabled={disabled}
      >
        <SelectTrigger id={`${idPrefix}DateFormat`}>
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
  );
}
