'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import type { NumberFormat, DateFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../shared/NumberFormatSection';
import { DateFormatSection } from '../shared/DateFormatSection';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
  prefix?: string;
  suffix?: string;
}

interface DateColumnFormatConfig {
  dateFormat?: DateFormat;
}

interface TableChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  availableColumns?: string[];
  availableDateColumns?: string[];
}

export function TableChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  availableColumns = [],
  availableDateColumns = [],
}: TableChartCustomizationsProps) {
  // Currently expanded column for configuration
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [expandedDateColumn, setExpandedDateColumn] = useState<string | null>(null);

  // Get existing column formatting from customizations
  const columnFormatting: Record<string, ColumnFormatConfig> =
    customizations.columnFormatting || {};
  const dateColumnFormatting: Record<string, DateColumnFormatConfig> =
    customizations.dateColumnFormatting || {};

  // Toggle column expansion
  const handleToggleColumn = (column: string) => {
    if (expandedColumn === column) {
      // Collapse if already expanded
      setExpandedColumn(null);
    } else {
      // Expand and load existing config if any
      setExpandedColumn(column);
    }
  };

  // Auto-save format configuration on any change
  const handleFormatChange = (column: string, numberFormat: NumberFormat) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: numberFormat,
        decimalPlaces: columnFormatting[column]?.decimalPlaces || 0,
      },
    };

    updateCustomization('columnFormatting', newFormatting);
  };

  // Auto-save decimal places on any change
  const handleDecimalChange = (column: string, decimalPlaces: number) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: columnFormatting[column]?.numberFormat || 'default',
        decimalPlaces: decimalPlaces,
      },
    };

    updateCustomization('columnFormatting', newFormatting);
  };

  // Remove formatting from a column
  const handleRemoveFormat = (column: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent toggle
    const newFormatting = { ...columnFormatting };
    delete newFormatting[column];
    updateCustomization('columnFormatting', newFormatting);

    if (expandedColumn === column) {
      setExpandedColumn(null);
    }
  };

  // Check if column has formatting
  const hasFormatting = (column: string) => {
    return !!columnFormatting[column];
  };

  // Toggle date column expansion
  const handleToggleDateColumn = (column: string) => {
    if (expandedDateColumn === column) {
      setExpandedDateColumn(null);
    } else {
      setExpandedDateColumn(column);
    }
  };

  // Auto-save date format configuration on any change
  const handleDateFormatChange = (column: string, dateFormat: DateFormat) => {
    const newFormatting = {
      ...dateColumnFormatting,
      [column]: {
        dateFormat: dateFormat,
      },
    };

    updateCustomization('dateColumnFormatting', newFormatting);
  };

  // Remove date formatting from a column
  const handleRemoveDateFormat = (column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFormatting = { ...dateColumnFormatting };
    delete newFormatting[column];
    updateCustomization('dateColumnFormatting', newFormatting);

    if (expandedDateColumn === column) {
      setExpandedDateColumn(null);
    }
  };

  // Check if date column has formatting
  const hasDateFormatting = (column: string) => {
    return !!dateColumnFormatting[column];
  };

  // Get date format display text
  const getDateFormatDisplay = (column: string) => {
    const config = dateColumnFormatting[column];

    const formatLabels: Record<string, string> = {
      default: 'No Formatting',
      iso_datetime: '%Y-%m-%d %H:%M:%S',
      dd_mm_yyyy: '%d/%m/%Y',
      mm_dd_yyyy: '%m/%d/%Y',
      yyyy_mm_dd: '%Y-%m-%d',
      dd_mm_yyyy_time: '%d-%m-%Y %H:%M:%S',
      time_only: '%H:%M:%S',
    };

    if (!config || !config.dateFormat || config.dateFormat === 'default') {
      return 'No Formatting';
    }

    return formatLabels[config.dateFormat] || config.dateFormat;
  };

  // Get format display text
  const getFormatDisplay = (column: string) => {
    const config = columnFormatting[column];

    const formatLabels: Record<string, string> = {
      default: 'No Formatting',
      indian: 'Indian',
      international: 'International',
      adaptive_indian: 'Adaptive Indian',
      adaptive_international: 'Adaptive International',
      european: 'European',
    };

    // If no config, show No Formatting
    if (!config) return 'No Formatting';

    const hasDecimalPlaces = config.decimalPlaces !== undefined && config.decimalPlaces > 0;
    const isDefaultFormat = !config.numberFormat || config.numberFormat === 'default';
    if (isDefaultFormat && hasDecimalPlaces) {
      return `${config.decimalPlaces} decimal places`;
    }

    const formatLabel = formatLabels[config.numberFormat || 'default'] || config.numberFormat;
    const decimals = hasDecimalPlaces ? ` • ${config.decimalPlaces} dec` : '';

    return `${formatLabel}${decimals}`;
  };

  return (
    <div className="space-y-6">
      {/* Number Formatting Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Number Formatting</h4>

        {availableColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No numeric columns to format.
          </p>
        ) : (
          /* Numeric Column List */
          <div className="space-y-1">
            {availableColumns.map((column) => {
              const isExpanded = expandedColumn === column;
              const isConfigured = hasFormatting(column);
              const config = columnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  {/* Column Row */}
                  <div
                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                      isExpanded
                        ? 'shadow-sm'
                        : isConfigured
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : 'hover:bg-muted/30'
                    }`}
                    onClick={() => handleToggleColumn(column)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{column}</div>
                        {!isExpanded && (
                          <div className="text-xs text-muted-foreground">
                            {getFormatDisplay(column)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remove button for configured columns */}
                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-black hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleRemoveFormat(column, e)}
                        disabled={disabled}
                      >
                        <RefreshCw className="h-3 w-3 " />
                      </Button>
                    )}
                  </div>

                  {/* Expanded Configuration Section */}
                  {isExpanded && (
                    <div className="ml-6 py-3 space-y-3">
                      <NumberFormatSection
                        idPrefix={`table-${column}`}
                        numberFormat={config?.numberFormat}
                        decimalPlaces={config?.decimalPlaces}
                        onNumberFormatChange={(value) => handleFormatChange(column, value)}
                        onDecimalPlacesChange={(value) => handleDecimalChange(column, value)}
                        excludeFormats={['percentage', 'currency']}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Date Formatting Section */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Date Formatting</h4>

        {availableDateColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No date columns to format.
          </p>
        ) : (
          /* Date Column List */
          <div className="space-y-1">
            {availableDateColumns.map((column) => {
              const isExpanded = expandedDateColumn === column;
              const isConfigured = hasDateFormatting(column);
              const config = dateColumnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  {/* Column Row */}
                  <div
                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                      isExpanded
                        ? 'shadow-sm'
                        : isConfigured
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : 'hover:bg-muted/30'
                    }`}
                    onClick={() => handleToggleDateColumn(column)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{column}</div>
                        {!isExpanded && (
                          <div className="text-xs text-muted-foreground">
                            {getDateFormatDisplay(column)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Remove button for configured columns */}
                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-black hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleRemoveDateFormat(column, e)}
                        disabled={disabled}
                      >
                        <RefreshCw className="h-3 w-3 " />
                      </Button>
                    )}
                  </div>

                  {/* Expanded Configuration Section */}
                  {isExpanded && (
                    <div className="ml-6 py-3 space-y-3">
                      <DateFormatSection
                        idPrefix={`table-date-${column}`}
                        dateFormat={config?.dateFormat}
                        onDateFormatChange={(value) => handleDateFormatChange(column, value)}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
