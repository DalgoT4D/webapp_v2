'use client';

import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import type { ChartDimension } from '@/types/charts';

interface TableDimensionsSelectorProps {
  dimensions: ChartDimension[];
  availableColumns: Array<{ column_name: string; data_type: string; name: string }>;
  onChange: (dimensions: ChartDimension[]) => void;
  disabled?: boolean;
}

export function TableDimensionsSelector({
  dimensions,
  availableColumns,
  onChange,
  disabled,
}: TableDimensionsSelectorProps) {
  // Get available columns that aren't already selected
  const getAvailableColumns = () => {
    const selectedColumns = dimensions.map((d) => d.column).filter(Boolean);
    return availableColumns.filter((col) => !selectedColumns.includes(col.column_name));
  };

  // Check if drill-down is enabled (if any dimension has it enabled)
  const isDrillDownEnabled = dimensions.some((d) => d.enable_drill_down === true);

  const handleDrillDownToggle = (enabled: boolean) => {
    // When drill-down is toggled, enable/disable it for all dimensions
    const newDimensions = dimensions.map((dim) => ({
      ...dim,
      enable_drill_down: enabled,
    }));
    onChange(newDimensions);
  };

  const handleAddDimension = () => {
    const availableCols = getAvailableColumns();
    if (availableCols.length > 0) {
      const newDimension: ChartDimension = {
        column: availableCols[0].column_name,
        enable_drill_down: isDrillDownEnabled, // Inherit current drill-down state
      };
      onChange([...dimensions, newDimension]);
    }
  };

  const handleRemoveDimension = (index: number) => {
    const newDimensions = dimensions.filter((_, i) => i !== index);
    onChange(newDimensions);
  };

  const handleDimensionChange = (index: number, field: keyof ChartDimension, value: any) => {
    const newDimensions = [...dimensions];
    newDimensions[index] = {
      ...newDimensions[index],
      [field]: value,
    };
    onChange(newDimensions);
  };

  // Ensure at least one dimension exists (default)
  const effectiveDimensions =
    dimensions.length > 0 ? dimensions : [{ column: '', enable_drill_down: false }];

  return (
    <div className="space-y-4">
      {/* Drill Down Toggle - Single toggle at the top */}
      <div className="flex items-center space-x-2">
        <Switch
          id="drill-down-toggle"
          checked={isDrillDownEnabled}
          onCheckedChange={(checked) => handleDrillDownToggle(checked)}
          disabled={disabled || effectiveDimensions.length === 0}
        />
        <Label htmlFor="drill-down-toggle" className="text-sm font-medium cursor-pointer">
          Drill Down
        </Label>
      </div>

      {/* Dimensions List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Dimension</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddDimension}
              disabled={disabled || getAvailableColumns().length === 0}
            >
              <Plus className="h-4 w-4 mr-1" />
              ADD DIMENSION(s)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {effectiveDimensions.map((dimension, index) => {
            return (
              <div
                key={index}
                className="flex items-center justify-between gap-2 p-2 border rounded-md hover:bg-gray-50/50"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Select
                    value={dimension.column || ''}
                    onValueChange={(value) => handleDimensionChange(index, 'column', value)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-9 flex-1 min-w-0">
                      <SelectValue placeholder="Select dimension column" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableColumns.map((col) => (
                        <SelectItem key={col.column_name} value={col.column_name}>
                          <div className="flex items-center gap-2 min-w-0">
                            <ColumnTypeIcon
                              dataType={col.data_type}
                              className="w-4 h-4 flex-shrink-0"
                            />
                            <span
                              className="truncate"
                              title={`${col.column_name} (${col.data_type})`}
                            >
                              {col.column_name}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleRemoveDimension(index)}
                  disabled={disabled || effectiveDimensions.length === 1}
                  title="Remove dimension"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}

          {effectiveDimensions.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">
              No dimensions configured. Add at least one dimension to display data.
            </div>
          )}

          {isDrillDownEnabled && effectiveDimensions.length > 0 && (
            <div className="text-xs text-muted-foreground mt-2 pt-2 border-t">
              Drill-down will follow the order:{' '}
              {effectiveDimensions
                .map((d, i) => d.column || `Dimension ${i + 1}`)
                .filter(Boolean)
                .join(' → ')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
