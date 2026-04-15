'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { NumberFormats, type NumberFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../shared/NumberFormatSection';
import { ConditionalFormattingSection } from './ConditionalFormattingSection';
import { ColumnSettingsSection } from './ColumnSettingsSection';
import { AppearanceSection } from './AppearanceSection';
import type { ConditionalFormattingRule, ColumnAlignment } from './types';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
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
}: TableChartCustomizationsProps) {
  // Currently expanded column for number formatting configuration
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  // Get existing customization values
  const columnFormatting: Record<string, ColumnFormatConfig> =
    customizations.columnFormatting || {};
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
        decimalPlaces: columnFormatting[column]?.decimalPlaces || 0,
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

      {/* Section 3: Number Formatting (existing) */}
      {availableColumns.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Number Formatting</h4>
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
        </div>
      )}

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
