'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { NumberFormats, type NumberFormat, type DateFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../types/shared/NumberFormatSection';
import { DateFormatSection } from '../types/shared/DateFormatSection';
import { ConditionalFormattingSection } from '../types/table/ConditionalFormattingSection';
import { AppearanceSection } from '../types/table/AppearanceSection';
import type { ConditionalFormattingRule } from '../types/table/types';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

interface DateColumnFormatConfig {
  dateFormat?: DateFormat;
}

interface PivotTableCustomizationsProps {
  customizations: Record<string, unknown>;
  updateCustomization: (key: string, value: unknown) => void;
  disabled?: boolean;
  /** Metric column names available for number formatting */
  metricColumns?: string[];
  /** Datetime dimension columns (row + column) with no time grain — eligible for date formatting */
  dateColumns?: string[];
}

export default function PivotTableCustomizations({
  customizations,
  updateCustomization,
  disabled,
  metricColumns = [],
  dateColumns = [],
}: PivotTableCustomizationsProps) {
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  // Get existing customization values
  const columnFormatting: Record<string, ColumnFormatConfig> =
    (customizations.columnFormatting as Record<string, ColumnFormatConfig>) || {};
  const conditionalFormatting: ConditionalFormattingRule[] =
    (customizations.conditionalFormatting as ConditionalFormattingRule[]) || [];
  const zebraRows: boolean = (customizations.zebraRows as boolean) || false;
  const freezeFirstColumn: boolean = (customizations.freezeFirstColumn as boolean) || false;
  const theme: string | undefined = customizations.theme as string | undefined;
  const dateColumnFormatting: Record<string, DateColumnFormatConfig> =
    (customizations.dateColumnFormatting as Record<string, DateColumnFormatConfig>) || {};

  // --- Date Formatting handler (display-only, for ungrained datetime dimensions) ---
  const handleDateFormatChange = useCallback(
    (column: string, dateFormat: DateFormat) => {
      const next = { ...dateColumnFormatting };
      if (dateFormat === 'default') {
        delete next[column];
      } else {
        next[column] = { dateFormat };
      }
      updateCustomization('dateColumnFormatting', next);
    },
    [dateColumnFormatting, updateCustomization]
  );

  // --- Number Formatting handlers ---
  const handleToggleColumn = useCallback(
    (column: string) => {
      setExpandedColumn(expandedColumn === column ? null : column);
    },
    [expandedColumn]
  );

  const handleFormatChange = useCallback(
    (column: string, numberFormat: NumberFormat) => {
      const newFormatting = {
        ...columnFormatting,
        [column]: {
          numberFormat,
          decimalPlaces: columnFormatting[column]?.decimalPlaces || 0,
        },
      };
      updateCustomization('columnFormatting', newFormatting);
    },
    [columnFormatting, updateCustomization]
  );

  const handleDecimalChange = useCallback(
    (column: string, decimalPlaces: number) => {
      const newFormatting = {
        ...columnFormatting,
        [column]: {
          numberFormat: columnFormatting[column]?.numberFormat || 'default',
          decimalPlaces,
        },
      };
      updateCustomization('columnFormatting', newFormatting);
    },
    [columnFormatting, updateCustomization]
  );

  const handleRemoveFormat = useCallback(
    (column: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const newFormatting = { ...columnFormatting };
      delete newFormatting[column];
      updateCustomization('columnFormatting', newFormatting);
      if (expandedColumn === column) {
        setExpandedColumn(null);
      }
    },
    [columnFormatting, expandedColumn, updateCustomization]
  );

  const hasFormatting = (column: string) => !!columnFormatting[column];

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
    <div className="space-y-6" data-testid="pivot-table-customizations">
      {/* Section 1: Number Formatting (per-metric) */}
      {metricColumns.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Number Formatting</h4>
          <div className="space-y-1">
            {metricColumns.map((column) => {
              const isExpanded = expandedColumn === column;
              const isConfigured = hasFormatting(column);
              const config = columnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  <div
                    data-testid={`pivot-column-row-${column}`}
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
                        data-testid={`pivot-remove-format-${column}`}
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
                        idPrefix={`pivot-${column}`}
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
        </div>
      )}

      {/* Section 1b: Date Formatting (per datetime dimension without a time grain) */}
      {dateColumns.length > 0 && (
        <div className="space-y-4" data-testid="pivot-date-formatting">
          <div>
            <h4 className="text-sm font-medium">Date Formatting</h4>
            <p className="text-xs text-muted-foreground">
              Display format for date dimensions. Columns with a time grain are formatted by their
              grain instead.
            </p>
          </div>
          <div className="space-y-4">
            {dateColumns.map((column) => (
              <div key={column} className="space-y-2" data-testid={`pivot-date-format-${column}`}>
                <div className="text-sm font-medium truncate">{column}</div>
                <DateFormatSection
                  idPrefix={`pivot-${column}`}
                  dateFormat={dateColumnFormatting[column]?.dateFormat}
                  onDateFormatChange={(value) => handleDateFormatChange(column, value)}
                  disabled={disabled}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Conditional Formatting */}
      <ConditionalFormattingSection
        rules={conditionalFormatting}
        onChange={(rules) => updateCustomization('conditionalFormatting', rules)}
        availableColumns={metricColumns}
        disabled={disabled}
      />

      {/* Section 3: Appearance (zebra rows + theme) */}
      <AppearanceSection
        zebraRows={zebraRows}
        themeId={theme}
        onZebraRowsChange={(val) => updateCustomization('zebraRows', val)}
        onThemeChange={(val) => updateCustomization('theme', val)}
        disabled={disabled}
      />

      {/* Freeze first column — surfaced separately since AppearanceSection no longer owns it */}
      <div className="flex items-center justify-between p-2 rounded-md border">
        <div>
          <Label htmlFor="pivot-freeze-column" className="text-sm cursor-pointer">
            Freeze first column
          </Label>
          <p className="text-xs text-muted-foreground">
            Pin the first column when scrolling horizontally
          </p>
        </div>
        <Switch
          id="pivot-freeze-column"
          data-testid="pivot-freeze-column-switch"
          checked={freezeFirstColumn}
          onCheckedChange={(val) => updateCustomization('freezeFirstColumn', val)}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
