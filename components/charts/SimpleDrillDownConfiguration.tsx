'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Info } from 'lucide-react';
import type { ChartBuilderFormData, TableColumn } from '@/types/charts';

interface SimpleDrillDownConfigurationProps {
  formData: ChartBuilderFormData;
  columns?: TableColumn[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
}

export function SimpleDrillDownConfiguration({
  formData,
  columns = [],
  onChange,
}: SimpleDrillDownConfigurationProps) {
  const availableColumns = columns.map((col) => col.name);

  // Get current configuration
  const selectedColumns = formData.table_columns || [];
  const drillDownColumn = formData.extra_config?.drill_down_column || '';
  const maxDrillLevels = formData.extra_config?.max_drill_levels || 3;
  const aggregationColumns = formData.extra_config?.aggregation_columns || [];

  const handleColumnsChange = (newColumns: string[]) => {
    onChange({ table_columns: newColumns });
  };

  const handleColumnToggle = (column: string, checked: boolean) => {
    if (checked) {
      handleColumnsChange([...selectedColumns, column]);
    } else {
      handleColumnsChange(selectedColumns.filter((col) => col !== column));
    }
  };

  const handleSelectAllColumns = () => {
    handleColumnsChange(availableColumns);
  };

  const handleClearAllColumns = () => {
    handleColumnsChange([]);
  };

  const handleDrillDownColumnChange = (column: string) => {
    onChange({
      extra_config: {
        ...formData.extra_config,
        drill_down_column: column,
      },
    });
  };

  const handleMaxLevelsChange = (value: string) => {
    const levels = parseInt(value) || 3;
    onChange({
      extra_config: {
        ...formData.extra_config,
        max_drill_levels: Math.min(Math.max(levels, 1), 5), // Clamp between 1-5
      },
    });
  };

  const handleAggregationToggle = (column: string, checked: boolean) => {
    const newAggregations = checked
      ? [...aggregationColumns, column]
      : aggregationColumns.filter((col) => col !== column);

    onChange({
      extra_config: {
        ...formData.extra_config,
        aggregation_columns: newAggregations,
      },
    });
  };

  // Only show numeric columns for aggregation
  const numericColumns = columns.filter(
    (col) =>
      col.data_type?.includes('int') ||
      col.data_type?.includes('float') ||
      col.data_type?.includes('numeric') ||
      col.data_type?.includes('decimal') ||
      col.data_type?.includes('double')
  );

  return (
    <div className="space-y-4">
      {/* Table Columns Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Display Columns</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 mb-4">
            <Button variant="outline" size="sm" onClick={handleSelectAllColumns}>
              Select All
            </Button>
            <Button variant="outline" size="sm" onClick={handleClearAllColumns}>
              Clear All
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
            {availableColumns.map((column) => (
              <div key={column} className="flex items-center space-x-2">
                <Checkbox
                  id={`col-${column}`}
                  checked={selectedColumns.includes(column)}
                  onCheckedChange={(checked) => handleColumnToggle(column, checked as boolean)}
                />
                <Label
                  htmlFor={`col-${column}`}
                  className="text-sm font-normal cursor-pointer truncate"
                  title={column}
                >
                  {column}
                </Label>
              </div>
            ))}
          </div>

          <div className="text-sm text-muted-foreground">
            Selected {selectedColumns.length} of {availableColumns.length} columns
          </div>
        </CardContent>
      </Card>

      {/* Drill-Down Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Drill-Down Settings
            <Info className="w-4 h-4 text-muted-foreground" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="drill-down-column">Drill-Down Column</Label>
            <Select value={drillDownColumn} onValueChange={handleDrillDownColumnChange}>
              <SelectTrigger id="drill-down-column">
                <SelectValue placeholder="Select column to enable drill-down" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None (No Drill-Down)</SelectItem>
                {availableColumns.map((column) => (
                  <SelectItem key={column} value={column}>
                    {column}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Clicking on values in this column will drill down to the next level
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-levels">Maximum Drill-Down Levels</Label>
            <Input
              id="max-levels"
              type="number"
              min={1}
              max={5}
              value={maxDrillLevels}
              onChange={(e) => handleMaxLevelsChange(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              How many levels deep users can drill (1-5)
            </p>
          </div>

          {drillDownColumn && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm">
              <strong>How it works:</strong> Click on any value in the "{drillDownColumn}" column to
              filter the data and see more details. Navigate back using the breadcrumb trail.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregation Columns */}
      {numericColumns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Metrics to Aggregate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select numeric columns to calculate totals when drilling down
            </p>

            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {numericColumns.map((column) => (
                <div key={column.name} className="flex items-center space-x-2">
                  <Checkbox
                    id={`agg-${column.name}`}
                    checked={aggregationColumns.includes(column.name)}
                    onCheckedChange={(checked) =>
                      handleAggregationToggle(column.name, checked as boolean)
                    }
                  />
                  <Label
                    htmlFor={`agg-${column.name}`}
                    className="text-sm font-normal cursor-pointer truncate"
                    title={`${column.name} (${column.data_type})`}
                  >
                    {column.name}
                    <span className="text-xs text-muted-foreground ml-1">({column.data_type})</span>
                  </Label>
                </div>
              ))}
            </div>

            {aggregationColumns.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Selected {aggregationColumns.length} metric(s) for aggregation (SUM)
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
