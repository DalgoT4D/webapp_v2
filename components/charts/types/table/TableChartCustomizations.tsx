'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { NumberFormats, type NumberFormat, type DateFormat } from '@/lib/formatters';
import { NumberFormatSection, NUMBER_FORMAT_OPTIONS } from '../shared/NumberFormatSection';
import { DateFormatSection, DATE_FORMAT_OPTIONS } from '../shared/DateFormatSection';
import { ConditionalFormattingSection } from './ConditionalFormattingSection';
import { ColumnSettingsSection } from './ColumnSettingsSection';
import { AppearanceSection } from './AppearanceSection';
import type { ConditionalFormattingRule, ColumnAlignment } from './types';

// Compact label lookup derived from shared options (strips the " (example)" suffix)
const DATE_FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  DATE_FORMAT_OPTIONS.map((opt) => [opt.value, opt.label.split(' (')[0]])
);

const NUMBER_FORMAT_LABELS: Record<string, string> = Object.fromEntries(
  NUMBER_FORMAT_OPTIONS.map((opt) => [opt.value, opt.label.split(' (')[0]])
);

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

interface DateColumnFormatConfig {
  dateFormat?: DateFormat;
}

interface TableChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  /** Numeric columns only — for number formatting section */
  availableColumns?: string[];
  /** All displayed columns — for column order, alignment, conditional formatting */
  allColumns?: string[];
  /** Maps each displayed column to its type — used by conditional formatting */
  columnTypeMap?: Record<string, 'numeric' | 'text'>;
  /** Whether drill-down is enabled on this chart */
  drillDownEnabled?: boolean;
  /** Ordered drill-down dimension column names (filtered by enable_drill_down) */
  orderedDimensions?: string[];
  /** Callback to update table_columns order in formData */
  onTableColumnsChange?: (columns: string[]) => void;
  availableDateColumns?: string[];
}

export function TableChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  availableColumns = [],
  allColumns = [],
  columnTypeMap,
  drillDownEnabled,
  orderedDimensions,
  onTableColumnsChange,
  availableDateColumns = [],
}: TableChartCustomizationsProps) {
  // Currently expanded column for number formatting configuration
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [expandedDateColumn, setExpandedDateColumn] = useState<string | null>(null);

  // Get existing customization values
  const columnFormatting: Record<string, ColumnFormatConfig> =
    customizations.columnFormatting || {};
  const dateColumnFormatting: Record<string, DateColumnFormatConfig> =
    customizations.dateColumnFormatting || {};
  const conditionalFormatting: ConditionalFormattingRule[] =
    customizations.conditionalFormatting || [];
  const columnAlignment: Record<string, ColumnAlignment> = customizations.columnAlignment || {};
  const zebraRows: boolean = customizations.zebraRows || false;
  const freezeFirstColumn: boolean = customizations.freezeFirstColumn || false;
  const theme: string | undefined = customizations.theme as string | undefined;

  // --- Number Formatting handlers (existing logic preserved) ---
  const handleToggleColumn = (column: string) => {
    setExpandedColumn(expandedColumn === column ? null : column);
  };

  const handleFormatChange = (column: string, numberFormat: NumberFormat) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: numberFormat,
        decimalPlaces: columnFormatting[column]?.decimalPlaces,
      },
    };
    updateCustomization('columnFormatting', newFormatting);
  };

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

  const handleRemoveFormat = (column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFormatting = { ...columnFormatting };
    delete newFormatting[column];
    updateCustomization('columnFormatting', newFormatting);
    if (expandedColumn === column) {
      setExpandedColumn(null);
    }
  };

  const hasFormatting = (column: string) => !!columnFormatting[column];

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

    if (!config || !config.dateFormat || config.dateFormat === 'default') {
      return 'No Formatting';
    }

    return DATE_FORMAT_LABELS[config.dateFormat] || config.dateFormat;
  };

  // Get format display text
  const getFormatDisplay = (column: string) => {
    const config = columnFormatting[column];

    if (!config) return 'No Formatting';
    const hasDecimalPlaces = config.decimalPlaces !== undefined && config.decimalPlaces > 0;
    const isDefaultFormat = !config.numberFormat || config.numberFormat === 'default';
    if (isDefaultFormat && hasDecimalPlaces) {
      return `${config.decimalPlaces} decimal places`;
    }

    const formatLabel =
      NUMBER_FORMAT_LABELS[config.numberFormat || 'default'] || config.numberFormat;
    const decimals = hasDecimalPlaces ? ` • ${config.decimalPlaces} dec` : '';
    return `${formatLabel}${decimals}`;
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Column Order & Alignment (merged) */}
      {allColumns.length > 0 && onTableColumnsChange && (
        <ColumnSettingsSection
          columns={allColumns}
          alignment={columnAlignment}
          onOrderChange={onTableColumnsChange}
          onAlignmentChange={(val: Record<string, ColumnAlignment>) =>
            updateCustomization('columnAlignment', val)
          }
          disabled={disabled}
        />
      )}

      {/* Section 2: Number Formatting */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Number Formatting</h4>

        {availableColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No numeric columns to format.
          </p>
        ) : (
          <div className="space-y-1">
            {availableColumns.map((column) => {
              const isExpanded = expandedColumn === column;
              const isConfigured = hasFormatting(column);
              const config = columnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  <div
                    data-testid={`column-row-${column}`}
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
                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`remove-format-${column}`}
                        className="h-6 w-6 text-black hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleRemoveFormat(column, e)}
                        disabled={disabled}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="ml-6 py-3 space-y-3">
                      <NumberFormatSection
                        idPrefix={`table-${column}`}
                        numberFormat={config?.numberFormat}
                        decimalPlaces={config?.decimalPlaces}
                        onNumberFormatChange={(value) => handleFormatChange(column, value)}
                        onDecimalPlacesChange={(value) => handleDecimalChange(column, value)}
                        excludeFormats={[NumberFormats.PERCENTAGE, NumberFormats.CURRENCY]}
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

      {/* Section 3: Date Formatting */}
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Date Formatting</h4>

        {availableDateColumns.length === 0 ? (
          <p className="text-sm text-muted-foreground py-2 text-center">
            No date columns to format.
          </p>
        ) : (
          <div className="space-y-1">
            {availableDateColumns.map((column) => {
              const isExpanded = expandedDateColumn === column;
              const isConfigured = hasDateFormatting(column);
              const config = dateColumnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  <div
                    className={`flex items-center justify-between p-2 rounded-md border transition-colors ${
                      isExpanded
                        ? 'shadow-sm'
                        : isConfigured
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : 'hover:bg-muted/30'
                    }`}
                  >
                    <button
                      type="button"
                      className="flex items-center gap-2 flex-1 min-w-0 text-left bg-transparent border-none cursor-pointer"
                      onClick={() => handleToggleDateColumn(column)}
                      aria-expanded={isExpanded}
                      data-testid={`table-date-column-toggle-${column}`}
                    >
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
                    </button>

                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-black hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleRemoveDateFormat(column, e)}
                        disabled={disabled}
                        aria-label={`Reset date format for ${column}`}
                        data-testid={`table-date-column-reset-${column}`}
                      >
                        <RefreshCw className="h-3 w-3 " />
                      </Button>
                    )}
                  </div>

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

      {/* Section 4: Conditional Formatting */}
      <ConditionalFormattingSection
        rules={conditionalFormatting}
        onChange={(rules) => updateCustomization('conditionalFormatting', rules)}
        availableColumns={allColumns.length > 0 ? allColumns : availableColumns}
        columnTypeMap={columnTypeMap}
        drillDownEnabled={drillDownEnabled}
        orderedDimensions={orderedDimensions}
        disabled={disabled}
      />

      {/* Section 5: Appearance */}
      <AppearanceSection
        zebraRows={zebraRows}
        freezeFirstColumn={freezeFirstColumn}
        themeId={theme}
        onZebraRowsChange={(val) => updateCustomization('zebraRows', val)}
        onFreezeFirstColumnChange={(val) => updateCustomization('freezeFirstColumn', val)}
        onThemeChange={(val) => updateCustomization('theme', val)}
        disabled={disabled}
      />
    </div>
  );
}
