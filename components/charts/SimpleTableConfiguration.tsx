'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import type { DrillDownConfig } from '@/types/charts';

interface SimpleTableConfigurationProps {
  availableColumns: string[];
  columnTypes?: Record<string, string>;
  selectedColumns: string[];
  onColumnsChange: (columns: string[]) => void;
  drillDownConfig?: DrillDownConfig;
  onDrillDownConfigChange?: (config: DrillDownConfig) => void;
}

export function SimpleTableConfiguration({
  availableColumns,
  columnTypes = {},
  selectedColumns,
  onColumnsChange,
  drillDownConfig,
  onDrillDownConfigChange,
}: SimpleTableConfigurationProps) {
  const handleColumnToggle = (column: string, checked: boolean) => {
    if (checked) {
      onColumnsChange([...selectedColumns, column]);
    } else {
      onColumnsChange(selectedColumns.filter((col) => col !== column));
    }
  };

  const handleSelectAllColumns = () => {
    onColumnsChange(availableColumns);
  };

  const handleClearAllColumns = () => {
    onColumnsChange([]);
  };

  const isDrillDownEnabled = drillDownConfig?.enabled || false;
  const hierarchyLevels = drillDownConfig?.hierarchy || [];
  const maxDrillLevels = hierarchyLevels.length || 3;

  const handleDrillDownToggle = (checked: boolean) => {
    if (onDrillDownConfigChange) {
      onDrillDownConfigChange({
        enabled: checked,
        hierarchy:
          checked && hierarchyLevels.length === 0
            ? [
                {
                  level: 0,
                  column: availableColumns[0] || '',
                  display_name: availableColumns[0] || '',
                },
              ]
            : hierarchyLevels,
      });
    }
  };

  const handleHierarchyLevelChange = (levelIndex: number, column: string) => {
    if (onDrillDownConfigChange) {
      const newHierarchy = [...hierarchyLevels];
      // ✅ FIX: Preserve aggregation columns from level 0 (shared across all levels)
      const sharedAggCols = hierarchyLevels[0]?.aggregation_columns || [];
      newHierarchy[levelIndex] = {
        level: levelIndex,
        column,
        display_name: column,
        aggregation_columns: sharedAggCols,
      };
      onDrillDownConfigChange({
        enabled: isDrillDownEnabled,
        hierarchy: newHierarchy,
      });
    }
  };

  const handleAddLevel = () => {
    if (onDrillDownConfigChange && hierarchyLevels.length < 5) {
      // ✅ FIX: New levels should inherit aggregation columns from level 0
      const sharedAggCols = hierarchyLevels[0]?.aggregation_columns || [];
      const newLevel = {
        level: hierarchyLevels.length,
        column: availableColumns[0] || '',
        display_name: availableColumns[0] || '',
        aggregation_columns: sharedAggCols,
      };
      onDrillDownConfigChange({
        enabled: isDrillDownEnabled,
        hierarchy: [...hierarchyLevels, newLevel],
      });
    }
  };

  const handleRemoveLevel = (levelIndex: number) => {
    if (onDrillDownConfigChange) {
      const newHierarchy = hierarchyLevels
        .filter((_, idx) => idx !== levelIndex)
        .map((level, idx) => ({ ...level, level: idx }));
      onDrillDownConfigChange({
        enabled: isDrillDownEnabled,
        hierarchy: newHierarchy,
      });
    }
  };

  // Get numeric columns for aggregation
  const numericColumns = availableColumns.filter((col) => {
    const type = columnTypes[col]?.toLowerCase() || '';
    return (
      type.includes('int') ||
      type.includes('float') ||
      type.includes('double') ||
      type.includes('decimal') ||
      type.includes('numeric')
    );
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Table Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Drill-down Configuration */}
        {onDrillDownConfigChange && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium">Drill-Down</h4>
                <p className="text-xs text-muted-foreground">
                  Enable hierarchical navigation through table data
                </p>
              </div>
              <Checkbox
                id="enable-drilldown"
                checked={isDrillDownEnabled}
                onCheckedChange={handleDrillDownToggle}
              />
            </div>

            {isDrillDownEnabled && (
              <div className="space-y-4 pl-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Hierarchy Levels</Label>
                    {hierarchyLevels.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddLevel}
                        className="h-7 text-xs"
                      >
                        + Add Level
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Define the hierarchy for drill-down (e.g., Country → Region → Sub-region)
                  </p>

                  {hierarchyLevels.map((level, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 border rounded-md">
                      <div className="flex-shrink-0 w-20">
                        <span className="text-xs font-medium text-muted-foreground">
                          Level {index + 1}
                        </span>
                      </div>
                      <div className="flex-1">
                        <Select
                          value={level.column}
                          onValueChange={(value) => handleHierarchyLevelChange(index, value)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder="Select column" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableColumns.map((col) => (
                              <SelectItem key={col} value={col}>
                                {col}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {hierarchyLevels.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLevel(index)}
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          ×
                        </Button>
                      )}
                    </div>
                  ))}

                  {hierarchyLevels.length === 0 && (
                    <div className="text-xs text-muted-foreground p-2 border border-dashed rounded-md text-center">
                      Click "Add Level" to configure hierarchy
                    </div>
                  )}
                </div>

                {numericColumns.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm">Aggregation Columns (Optional)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Numeric columns to aggregate (SUM) when drilling down
                    </p>
                    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                      {numericColumns.map((column) => (
                        <div key={column} className="flex items-center space-x-2">
                          <Checkbox
                            id={`agg-${column}`}
                            checked={
                              hierarchyLevels[0]?.aggregation_columns?.includes(column) || false
                            }
                            onCheckedChange={(checked) => {
                              if (onDrillDownConfigChange && hierarchyLevels.length > 0) {
                                const currentAggCols =
                                  hierarchyLevels[0]?.aggregation_columns || [];
                                const newAggCols = checked
                                  ? [...currentAggCols, column]
                                  : currentAggCols.filter((c) => c !== column);

                                // ✅ FIX: Apply aggregation columns to ALL hierarchy levels
                                const newHierarchy = hierarchyLevels.map((level) => ({
                                  ...level,
                                  aggregation_columns: newAggCols,
                                }));

                                onDrillDownConfigChange({
                                  enabled: isDrillDownEnabled,
                                  hierarchy: newHierarchy,
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`agg-${column}`}
                            className="text-xs font-normal cursor-pointer"
                          >
                            {column}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
