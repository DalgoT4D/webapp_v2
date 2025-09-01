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
import { Badge } from '@/components/ui/badge';
import { ChevronRight, Navigation, CheckCircle, Loader2 } from 'lucide-react';
import { useColumns, useAvailableRegionTypes } from '@/hooks/api/useChart';
import type { ChartBuilderFormData } from '@/types/charts';

interface DynamicLevelConfigProps {
  formData: ChartBuilderFormData;
  onChange: (data: Partial<ChartBuilderFormData>) => void;
}

export function DynamicLevelConfig({ formData, onChange }: DynamicLevelConfigProps) {
  // Fetch available columns
  const { data: columns = [] } = useColumns(formData.schema_name || '', formData.table_name || '');

  // Fetch available region types from backend
  const { data: regionTypes = [], isLoading: regionTypesLoading } = useAvailableRegionTypes('IND');

  // Show component only if we have a geographic column selected
  if (!formData.geographic_column) return null;

  // Get available text columns (exclude already used columns)
  const getAvailableTextColumns = (excludeColumns: string[]) => {
    return columns.filter((col: any) => {
      const columnName = col.column_name || col.name;
      const dataType = col.data_type || col.type || '';
      const isTextType = ['text', 'varchar', 'character varying', 'char', 'string'].some((type) =>
        dataType.toLowerCase().includes(type)
      );
      return isTextType && !excludeColumns.includes(columnName) && columnName;
    });
  };

  // Build actual hierarchical chain by analyzing parent-child relationships
  const getRegionTypeHierarchy = () => {
    if (!regionTypes || regionTypes.length === 0) return [];

    // Build parent-child relationship map
    const parentChildMap = new Map<string, string[]>();
    const childParentMap = new Map<string, string>();

    // First pass: build the relationships
    regionTypes.forEach((region: any) => {
      const type = region.type;
      if (!type) return;

      if (region.parent_id) {
        // Find parent region
        const parentRegion = regionTypes.find((r: any) => r.id === region.parent_id);
        if (parentRegion && parentRegion.type) {
          const parentType = parentRegion.type;

          // Add to parent-child map
          if (!parentChildMap.has(parentType)) {
            parentChildMap.set(parentType, []);
          }
          if (!parentChildMap.get(parentType)!.includes(type)) {
            parentChildMap.get(parentType)!.push(type);
          }

          // Add to child-parent map
          childParentMap.set(type, parentType);
        }
      }
    });

    // Find the root type (type with no parent)
    const allTypes = new Set(regionTypes.map((r: any) => r.type).filter(Boolean));
    const rootTypes = Array.from(allTypes).filter((type) => !childParentMap.has(type));

    // Build the hierarchical chain starting from root
    const buildHierarchyChain = (startType: string): string[] => {
      const chain = [startType];
      let currentType = startType;

      while (parentChildMap.has(currentType) && parentChildMap.get(currentType)!.length > 0) {
        // Get the first child type (assuming linear hierarchy for now)
        const children = parentChildMap.get(currentType)!;
        currentType = children[0]; // Take first child
        chain.push(currentType);
      }

      return chain;
    };

    // Build hierarchy starting from the first root type
    if (rootTypes.length > 0) {
      return buildHierarchyChain(rootTypes[0]);
    }

    return [];
  };

  const regionHierarchy = getRegionTypeHierarchy();

  // Get current drill-down levels
  const currentLevels = formData.geographic_hierarchy?.drill_down_levels || [];
  const usedColumns = [
    formData.geographic_column,
    ...currentLevels.map((l) => l.column).filter(Boolean),
  ];

  const updateLevel = (levelIndex: number, column: string) => {
    // levelIndex corresponds to drill-down levels, so we need to add 1 to get the correct hierarchy position
    const regionType = regionHierarchy[levelIndex + 1];
    if (!regionType) return;

    // Create base hierarchy using the actual first level from the hierarchy
    const baseRegionType = regionHierarchy[0] || 'region';
    const baseHierarchy = {
      country_code: 'IND',
      base_level: {
        level: 0,
        column: formData.geographic_column || '',
        region_type: baseRegionType,
        label: baseRegionType.charAt(0).toUpperCase() + baseRegionType.slice(1),
      },
      drill_down_levels: [...currentLevels],
    };

    if (column === '') {
      // Remove this level and all subsequent levels
      baseHierarchy.drill_down_levels = baseHierarchy.drill_down_levels.slice(0, levelIndex);
    } else {
      // Ensure we have enough levels
      while (baseHierarchy.drill_down_levels.length <= levelIndex) {
        baseHierarchy.drill_down_levels.push({
          level: baseHierarchy.drill_down_levels.length + 1,
          column: '',
          region_type: '',
          label: '',
        });
      }

      // Update the specific level
      baseHierarchy.drill_down_levels[levelIndex] = {
        level: levelIndex + 1,
        column: column,
        region_type: regionType,
        label: regionType.charAt(0).toUpperCase() + regionType.slice(1),
      };

      // Trim empty levels at the end
      while (
        baseHierarchy.drill_down_levels.length > 0 &&
        !baseHierarchy.drill_down_levels[baseHierarchy.drill_down_levels.length - 1].column
      ) {
        baseHierarchy.drill_down_levels.pop();
      }
    }

    onChange({
      geographic_hierarchy: baseHierarchy,
      // Legacy support
      district_column: baseHierarchy.drill_down_levels[0]?.column || undefined,
    });
  };

  const shouldShowLevel = (levelIndex: number) => {
    // Show first level always (district level)
    if (levelIndex === 0) return true;

    // Show subsequent levels only if previous level is configured
    return currentLevels[levelIndex - 1]?.column;
  };

  if (regionTypesLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Geographic Levels...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-orange-600" />
          2. Drill-Down Levels (Optional)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Configure drill-down functionality based on available geographic levels in your database.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Show available region types */}
        {regionHierarchy.length > 1 && (
          <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
            <strong>Available drill-down levels:</strong> {regionHierarchy.slice(1).join(' → ')}
          </div>
        )}

        {/* Progressive Level Configuration - show next levels progressively */}
        {regionHierarchy.slice(1).map((regionType, index) => {
          if (!shouldShowLevel(index)) return null;

          const currentValue = currentLevels[index]?.column || '';
          const availableColumns = getAvailableTextColumns(usedColumns);
          const isConfigured = currentValue !== '';

          // Simple progressive naming: Level 1, Level 2, etc.
          const levelNumber = index + 1;
          const displayName = `Level ${levelNumber}`;

          return (
            <div key={`level-${index}`} className="space-y-2">
              <div className="flex items-center gap-2">
                {isConfigured && <CheckCircle className="h-4 w-4 text-green-600" />}
                <Label className="text-sm font-medium">
                  {displayName} Column {index === 0 ? '' : '(Optional)'}
                </Label>
              </div>

              <Select
                value={currentValue}
                onValueChange={(value) => {
                  updateLevel(index, value === '__none__' ? '' : value);
                }}
              >
                <SelectTrigger className={isConfigured ? 'border-green-200 bg-green-50' : ''}>
                  <SelectValue
                    placeholder={`Select column for ${displayName.toLowerCase()} (optional)`}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No drill-down</SelectItem>
                  {availableColumns.map((col: any) => {
                    const columnName = col.column_name || col.name;
                    const dataType = col.data_type || col.type || 'text';
                    return (
                      <SelectItem key={columnName} value={columnName}>
                        {columnName} ({dataType})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {isConfigured && (
                <p className="text-xs text-green-600 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Users can drill down to {displayName.toLowerCase()}
                </p>
              )}
            </div>
          );
        })}

        {/* Current Configuration Status */}
        {currentLevels.some((l) => l.column) && (
          <div className="pt-4 border-t">
            <div className="p-3 bg-green-50 border border-green-200 rounded-md">
              <p className="text-sm font-medium text-green-800 mb-2">Drill-down Flow:</p>
              <div className="flex items-center gap-2 text-sm text-green-700 flex-wrap">
                <span className="font-mono bg-white px-2 py-1 rounded border">
                  {formData.geographic_column}
                </span>
                {currentLevels
                  .filter((l) => l.column)
                  .map((level, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <ChevronRight className="h-3 w-3" />
                      <span className="font-mono bg-white px-2 py-1 rounded border">
                        {level.column}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Help text */}
        {!currentLevels.some((l) => l.column) && regionHierarchy.length > 1 && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              💡 <strong>Optional:</strong> Select a {regionHierarchy[1]} column above to enable
              drill-down functionality.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
