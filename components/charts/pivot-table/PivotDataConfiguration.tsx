'use client';

import { useCallback, useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Combobox } from '@/components/ui/combobox';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { TableDimensionsSelector } from '@/components/charts/TableDimensionsSelector';
import { TimeGrainSelector } from '@/components/charts/TimeGrainSelector';
import { ChartBuilderFormData, ChartDimension } from '@/types/charts';
import { MAX_ROW_DIMENSIONS, MAX_COLUMN_DIMENSIONS } from '@/constants/pivot-table';
import { X, Info } from 'lucide-react';

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
}

const DATETIME_TYPES = [
  'timestamp',
  'datetime',
  'date',
  'timestamptz',
  'timestamp without time zone',
  'timestamp with time zone',
];

function isDatetimeColumn(dataType: string): boolean {
  return DATETIME_TYPES.includes(dataType.toLowerCase());
}

export default function PivotDataConfiguration({
  formData,
  availableColumns,
  onChange,
  disabled = false,
}: PivotDataConfigurationProps) {
  // --- Row Dimensions ---
  const rowDimensionsAsDimensions: ChartDimension[] = useMemo(() => {
    return (formData.extra_config?.row_dimensions || []).map((col: string) => ({
      column: col,
      enable_drill_down: false,
    }));
  }, [formData.extra_config?.row_dimensions]);

  const handleRowDimensionsChange = useCallback(
    (dimensions: ChartDimension[]) => {
      onChange({
        extra_config: {
          ...formData.extra_config,
          row_dimensions: dimensions.map((d) => d.column),
        },
      });
    },
    [formData.extra_config, onChange]
  );

  // --- Column Dimensions (multiple) ---
  const columnDimensions: string[] = useMemo(
    () => formData.extra_config?.column_dimensions || [],
    [formData.extra_config?.column_dimensions]
  );

  const columnTimeGrains: Record<string, string> = useMemo(
    () => formData.extra_config?.column_time_grains || {},
    [formData.extra_config?.column_time_grains]
  );

  const addColumnDimension = useCallback(() => {
    if (columnDimensions.length >= MAX_COLUMN_DIMENSIONS) return;
    // Find first column not already used
    const usedCols = new Set(columnDimensions);
    const available = availableColumns.find((c) => !usedCols.has(c.column_name));
    if (!available) return;

    const newDims = [...columnDimensions, available.column_name];
    onChange({
      extra_config: {
        ...formData.extra_config,
        column_dimensions: newDims,
      },
    });
  }, [columnDimensions, availableColumns, formData.extra_config, onChange]);

  const removeColumnDimension = useCallback(
    (idx: number) => {
      const removed = columnDimensions[idx];
      const newDims = columnDimensions.filter((_, i) => i !== idx);
      const newGrains = { ...columnTimeGrains };
      delete newGrains[removed];
      onChange({
        extra_config: {
          ...formData.extra_config,
          column_dimensions: newDims,
          column_time_grains: newGrains,
        },
      });
    },
    [columnDimensions, columnTimeGrains, formData.extra_config, onChange]
  );

  const changeColumnDimension = useCallback(
    (idx: number, newCol: string) => {
      const oldCol = columnDimensions[idx];
      const newDims = [...columnDimensions];
      newDims[idx] = newCol;

      const newGrains = { ...columnTimeGrains };
      delete newGrains[oldCol];
      // Auto-set time grain if new column is datetime
      const colInfo = availableColumns.find((c) => c.column_name === newCol);
      if (colInfo && isDatetimeColumn(colInfo.data_type)) {
        newGrains[newCol] = 'month';
      }

      onChange({
        extra_config: {
          ...formData.extra_config,
          column_dimensions: newDims,
          column_time_grains: newGrains,
        },
      });
    },
    [columnDimensions, columnTimeGrains, availableColumns, formData.extra_config, onChange]
  );

  const changeTimeGrain = useCallback(
    (colName: string, grain: string | null) => {
      const newGrains = { ...columnTimeGrains };
      if (grain) {
        newGrains[colName] = grain;
      } else {
        delete newGrains[colName];
      }
      onChange({
        extra_config: {
          ...formData.extra_config,
          column_time_grains: newGrains,
        },
      });
    },
    [columnTimeGrains, formData.extra_config, onChange]
  );

  const columnItems = useMemo(
    () =>
      availableColumns.map((col) => ({
        value: col.column_name,
        label: col.name || col.column_name,
      })),
    [availableColumns]
  );

  return (
    <div className="space-y-6" data-testid="pivot-data-configuration">
      {/* Row Dimensions */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Label className="text-sm font-medium">Row Dimensions (1-{MAX_ROW_DIMENSIONS})</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px]">
              Fields used to group data into rows. Each unique combination of row dimension values
              creates a row in the pivot table.
            </TooltipContent>
          </Tooltip>
        </div>
        <TableDimensionsSelector
          dimensions={rowDimensionsAsDimensions}
          availableColumns={availableColumns}
          onChange={handleRowDimensionsChange}
          disabled={disabled}
          showDrillDown={false}
        />
      </div>

      {/* Column Dimensions (multiple) */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <Label className="text-sm font-medium">
            Column Dimensions (0-{MAX_COLUMN_DIMENSIONS}, optional)
          </Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" className="text-muted-foreground hover:text-foreground">
                <Info className="h-3.5 w-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[220px]">
              Fields whose unique values become column headers. Data is spread across these columns
              for cross-tabulation.
            </TooltipContent>
          </Tooltip>
        </div>

        <div className="space-y-3">
          {columnDimensions.map((colDim, idx) => {
            const colInfo = availableColumns.find((c) => c.column_name === colDim);
            const isDatetime = colInfo ? isDatetimeColumn(colInfo.data_type) : false;
            const grain = columnTimeGrains[colDim];

            return (
              <div key={`col-dim-${colDim}`} className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <Combobox
                      id={`pivot-column-dimension-${idx}`}
                      items={columnItems}
                      value={colDim}
                      onValueChange={(val: string) => changeColumnDimension(idx, val)}
                      placeholder="Select column..."
                      disabled={disabled}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeColumnDimension(idx)}
                    disabled={disabled}
                    data-testid={`remove-col-dim-${idx}`}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isDatetime && (
                  <div className="ml-2">
                    <TimeGrainSelector
                      value={grain || null}
                      onChange={(val: string | null) => changeTimeGrain(colDim, val)}
                      columnDataType={colInfo?.data_type}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <Button
            variant="outline"
            size="sm"
            onClick={addColumnDimension}
            disabled={disabled || columnDimensions.length >= MAX_COLUMN_DIMENSIONS}
            data-testid="add-column-dimension-btn"
            className="w-full"
          >
            + Add Column Dimension
          </Button>
        </div>
      </div>

      {/* Subtotal / Grand Total toggles */}
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
                  values for that group.
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
                      !formData.extra_config?.subtotal_label && { subtotal_label: 'Subtotal' }),
                  },
                })
              }
              disabled={disabled}
            />
          </div>
          {formData.extra_config?.show_row_subtotals && (
            <Input
              id="subtotal-display-name"
              data-testid="pivot-subtotal-display-name"
              placeholder="Subtotal"
              value={formData.extra_config?.subtotal_label ?? 'Subtotal'}
              onChange={(e) =>
                onChange({
                  extra_config: {
                    ...formData.extra_config,
                    subtotal_label: e.target.value,
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
          {formData.extra_config?.show_column_subtotals && (
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Label htmlFor="show-grand-total" className="text-sm">
                Show Grand Total
              </Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground">
                    <Info className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-[220px]">
                  Adds a final row at the bottom showing the overall total across all rows for each
                  metric.
                </TooltipContent>
              </Tooltip>
            </div>
            <Switch
              id="show-grand-total"
              data-testid="pivot-show-grand-total"
              checked={formData.extra_config?.show_grand_total ?? true}
              onCheckedChange={(checked: boolean) =>
                onChange({
                  extra_config: {
                    ...formData.extra_config,
                    show_grand_total: checked,
                    // Auto-set default label when enabling
                    ...(checked &&
                      !formData.extra_config?.grand_total_label && {
                        grand_total_label: 'Grand Total',
                      }),
                  },
                })
              }
              disabled={disabled}
            />
          </div>
          {formData.extra_config?.show_grand_total !== false && (
            <Input
              id="grand-total-display-name"
              data-testid="pivot-grand-total-display-name"
              placeholder="Grand Total"
              value={formData.extra_config?.grand_total_label ?? 'Grand Total'}
              onChange={(e) =>
                onChange({
                  extra_config: {
                    ...formData.extra_config,
                    grand_total_label: e.target.value,
                  },
                })
              }
              disabled={disabled}
              className="text-sm"
            />
          )}
        </div>
      </div>
    </div>
  );
}
