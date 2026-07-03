'use client';

import { useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { PivotDimensionList } from '@/components/charts/pivot-table/PivotDimensionList';
import { resolvePivotTotals } from '@/components/charts/pivot-table/utils';
import { ChartBuilderFormData } from '@/types/charts';
import { Info } from 'lucide-react';

interface ColumnInfo {
  column_name: string;
  data_type: string;
  name: string;
}

interface PivotDataConfigurationProps {
  formData: Partial<ChartBuilderFormData>;
  availableColumns: ColumnInfo[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
  /**
   * Which part of the config to render. Lets the parent place metrics/filters
   * between the dimensions and the subtotal/grand-total toggles.
   * 'all' (default) renders everything.
   */
  section?: 'all' | 'dimensions' | 'totals';
}

export default function PivotDataConfiguration({
  formData,
  availableColumns,
  onChange,
  disabled = false,
  section = 'all',
}: PivotDataConfigurationProps) {
  // --- Row Dimensions ---
  const rowDimensions: string[] = useMemo(
    () => formData.extra_config?.row_dimensions || [],
    [formData.extra_config?.row_dimensions]
  );

  const handleRowChange = useCallback(
    (next: { dimensions: string[] }) => {
      onChange({
        extra_config: {
          ...formData.extra_config,
          row_dimensions: next.dimensions,
        },
      });
    },
    [formData.extra_config, onChange]
  );

  // --- Column Dimensions ---
  const columnDimensions: string[] = useMemo(
    () => formData.extra_config?.column_dimensions || [],
    [formData.extra_config?.column_dimensions]
  );

  const handleColumnChange = useCallback(
    (next: { dimensions: string[] }) => {
      onChange({
        extra_config: {
          ...formData.extra_config,
          column_dimensions: next.dimensions,
        },
      });
    },
    [formData.extra_config, onChange]
  );

  // Independent grand-total flags
  const { showRowGrandTotal, showColumnGrandTotal } = resolvePivotTotals(formData.extra_config);

  return (
    <div className="space-y-6" data-testid="pivot-data-configuration">
      {section !== 'totals' && (
        <>
          {/* Row Dimensions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Label className="text-sm font-medium">Row Dimensions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  Fields used to group data into rows. Each unique combination of row dimension
                  values creates a row in the pivot table.
                </TooltipContent>
              </Tooltip>
            </div>
            <PivotDimensionList
              dimensions={rowDimensions}
              availableColumns={availableColumns}
              onChange={handleRowChange}
              minCount={1}
              idPrefix="row"
              addButtonLabel="Add Row Dimensions"
              disabled={disabled}
            />
          </div>

          {/* Column Dimensions */}
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Label className="text-sm font-medium">Column Dimensions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  Fields whose unique values become column headers. Data is spread across these
                  columns for cross-tabulation.
                </TooltipContent>
              </Tooltip>
            </div>
            <PivotDimensionList
              dimensions={columnDimensions}
              availableColumns={availableColumns}
              onChange={handleColumnChange}
              minCount={0}
              idPrefix="col"
              addButtonLabel="Add Column Dimensions"
              disabled={disabled}
            />
          </div>
        </>
      )}

      {/* Subtotal / Grand Total toggles */}
      {section !== 'dimensions' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="show-row-subtotals" className="text-sm">
                  Show Row Subtotals
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    Adds a subtotal row after each group of row dimensions, summarizing the metric
                    values for that group. Requires at least two row dimensions.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="show-row-subtotals"
                data-testid="pivot-show-row-subtotals"
                checked={formData.extra_config?.show_row_subtotals ?? false}
                onCheckedChange={(checked: boolean) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      show_row_subtotals: checked,
                      // Auto-set default label when enabling
                      ...(checked &&
                        !formData.extra_config?.row_subtotal_label && {
                          row_subtotal_label: 'Subtotal',
                        }),
                    },
                  })
                }
                disabled={disabled || rowDimensions.length < 2}
              />
            </div>
            {formData.extra_config?.show_row_subtotals && rowDimensions.length >= 2 && (
              <Input
                id="row-subtotal-display-name"
                data-testid="pivot-row-subtotal-display-name"
                placeholder="Subtotal"
                value={formData.extra_config?.row_subtotal_label ?? 'Subtotal'}
                onChange={(e) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      row_subtotal_label: e.target.value,
                    },
                  })
                }
                disabled={disabled}
                className="text-sm"
              />
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="show-column-subtotals" className="text-sm">
                  Show Column Subtotals
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    Adds subtotal columns after each group of column dimensions, summarizing metric
                    values for that group. Requires at least two column dimensions.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="show-column-subtotals"
                data-testid="pivot-show-column-subtotals"
                checked={formData.extra_config?.show_column_subtotals ?? false}
                onCheckedChange={(checked: boolean) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      show_column_subtotals: checked,
                      ...(checked &&
                        !formData.extra_config?.column_subtotal_label && {
                          column_subtotal_label: 'Subtotal',
                        }),
                    },
                  })
                }
                disabled={disabled || columnDimensions.length < 2}
              />
            </div>
            {formData.extra_config?.show_column_subtotals && columnDimensions.length >= 2 && (
              <Input
                id="column-subtotal-display-name"
                data-testid="pivot-column-subtotal-display-name"
                placeholder="Subtotal"
                value={formData.extra_config?.column_subtotal_label ?? 'Subtotal'}
                onChange={(e) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      column_subtotal_label: e.target.value,
                    },
                  })
                }
                disabled={disabled}
                className="text-sm"
              />
            )}
          </div>

          {/* Grand Total — Rows (rightmost total column, each row across columns) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="show-row-grand-total" className="text-sm">
                  Grand Total — Rows
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    Adds a rightmost &quot;Total&quot; column showing each row&apos;s total across
                    all column groups. Requires at least one column dimension.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="show-row-grand-total"
                data-testid="pivot-show-row-grand-total"
                checked={showRowGrandTotal}
                onCheckedChange={(checked: boolean) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      show_row_grand_total: checked,
                      // Auto-set default label when enabling
                      ...(checked &&
                        !formData.extra_config?.row_grand_total_label && {
                          row_grand_total_label: 'Grand Total',
                        }),
                    },
                  })
                }
                disabled={disabled || columnDimensions.length === 0}
              />
            </div>
            {showRowGrandTotal && columnDimensions.length > 0 && (
              <Input
                id="row-grand-total-display-name"
                data-testid="pivot-row-grand-total-display-name"
                placeholder="Grand Total"
                value={formData.extra_config?.row_grand_total_label ?? 'Grand Total'}
                onChange={(e) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      row_grand_total_label: e.target.value,
                    },
                  })
                }
                disabled={disabled}
                className="text-sm"
              />
            )}
          </div>

          {/* Grand Total — Columns (bottom total row, each column across rows) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Label htmlFor="show-column-grand-total" className="text-sm">
                  Grand Total — Columns
                </Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground">
                      <Info className="h-3.5 w-3.5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[220px]">
                    Adds a bottom &quot;Total&quot; row showing each column&apos;s total across all
                    rows. The overall total (corner) appears when both grand totals are on.
                  </TooltipContent>
                </Tooltip>
              </div>
              <Switch
                id="show-column-grand-total"
                data-testid="pivot-show-column-grand-total"
                checked={showColumnGrandTotal}
                onCheckedChange={(checked: boolean) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      show_column_grand_total: checked,
                      // Auto-set default label when enabling
                      ...(checked &&
                        !formData.extra_config?.column_grand_total_label && {
                          column_grand_total_label: 'Grand Total',
                        }),
                    },
                  })
                }
                disabled={disabled}
              />
            </div>
            {showColumnGrandTotal && (
              <Input
                id="column-grand-total-display-name"
                data-testid="pivot-column-grand-total-display-name"
                placeholder="Grand Total"
                value={formData.extra_config?.column_grand_total_label ?? 'Grand Total'}
                onChange={(e) =>
                  onChange({
                    extra_config: {
                      ...formData.extra_config,
                      column_grand_total_label: e.target.value,
                    },
                  })
                }
                disabled={disabled}
                className="text-sm"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
