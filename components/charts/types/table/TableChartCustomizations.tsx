'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Check, ChevronRight, ChevronDown } from 'lucide-react';
import type { NumberFormat } from '@/lib/formatters';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  precision?: number;
  prefix?: string;
  suffix?: string;
}

interface TableChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  availableColumns?: string[];
}

export function TableChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  availableColumns = [],
}: TableChartCustomizationsProps) {
  // Currently expanded column for configuration
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  // Temporary state for format settings while editing
  const [tempFormat, setTempFormat] = useState<NumberFormat>('default');
  const [tempDecimalPlaces, setTempDecimalPlaces] = useState(0);

  // Get existing column formatting from customizations
  const columnFormatting: Record<string, ColumnFormatConfig> =
    customizations.columnFormatting || {};

  // Toggle column expansion
  const handleToggleColumn = (column: string) => {
    if (expandedColumn === column) {
      // Collapse if already expanded
      setExpandedColumn(null);
    } else {
      // Expand and load existing config if any
      const config = columnFormatting[column];
      setTempFormat(config?.numberFormat || 'default');
      setTempDecimalPlaces(config?.precision || 0);
      setExpandedColumn(column);
    }
  };

  // Save the format configuration
  const handleSave = (column: string) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: tempFormat,
        precision: tempDecimalPlaces,
      },
    };

    updateCustomization('columnFormatting', newFormatting);
    setExpandedColumn(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setExpandedColumn(null);
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

  // Get format display text
  const getFormatDisplay = (column: string) => {
    const config = columnFormatting[column];

    const formatLabels: Record<string, string> = {
      default: 'Default',
      indian: 'Indian',
      international: 'International',
      adaptive_indian: 'Adaptive Indian',
      adaptive_international: 'Adaptive International',
      percentage: 'Percentage',
      currency: 'Currency',
    };

    // If no config, show Default
    if (!config) return 'Default';

    const formatLabel = formatLabels[config.numberFormat || 'default'] || config.numberFormat;
    const decimals =
      config.precision !== undefined && config.precision > 0 ? ` • ${config.precision} dec` : '';

    return `${formatLabel}${decimals}`;
  };

  if (availableColumns.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium">Number</h4>
        <p className="text-sm text-muted-foreground py-4 text-center">
          No columns available. Configure table data first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <h4 className="text-sm font-medium">Number Formatting</h4>

      {/* Column List */}
      <div className="space-y-1">
        {availableColumns.map((column) => {
          const isExpanded = expandedColumn === column;
          const isConfigured = hasFormatting(column);

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
                    <X className="h-3 w-3 " />
                  </Button>
                )}
              </div>

              {/* Expanded Configuration Section */}
              {isExpanded && (
                <div className="ml-6 py-3 space-y-3">
                  {/* Format Type */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Format Type</label>
                    <Select
                      value={tempFormat}
                      onValueChange={(value) => setTempFormat(value as NumberFormat)}
                      disabled={disabled}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">Default</SelectItem>
                        <SelectItem value="indian">Indian (12,34,567)</SelectItem>
                        <SelectItem value="international">International (1,234,567)</SelectItem>
                        <SelectItem value="adaptive_indian">Adaptive Indian (12.35L)</SelectItem>
                        <SelectItem value="adaptive_international">
                          Adaptive International (1.23M)
                        </SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="currency">Currency ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Decimal Places */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">
                      Decimal Places
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max="10"
                      value={tempDecimalPlaces}
                      onChange={(e) => setTempDecimalPlaces(parseInt(e.target.value) || 0)}
                      disabled={disabled}
                      className="h-9"
                    />
                  </div>

                  {/* Save and Cancel Buttons */}
                  <div className="flex gap-2 pt-1">
                    <Button
                      onClick={() => handleSave(column)}
                      disabled={disabled}
                      size="sm"
                      className="flex-1 bg-black hover:bg-black/90 "
                    >
                      Save
                    </Button>
                    <Button
                      onClick={handleCancel}
                      disabled={disabled}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
