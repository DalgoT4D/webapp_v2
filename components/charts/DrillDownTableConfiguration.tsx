'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Layers, ChevronDown, ChevronUp } from 'lucide-react';
import type {
  DrillDownConfig,
  DrillDownLevel,
  ClickableColumn,
  TableColumn,
  ChartBuilderFormData,
} from '@/types/charts';

interface DrillDownTableConfigurationProps {
  formData: ChartBuilderFormData;
  columns?: TableColumn[];
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const LINK_TYPES = [
  { value: 'internal', label: 'Internal Link' },
  { value: 'external', label: 'External Link' },
  { value: 'image', label: 'Image' },
  { value: 'report', label: 'Report' },
] as const;

export function DrillDownTableConfiguration({
  formData,
  columns = [],
  onChange,
  disabled = false,
}: DrillDownTableConfigurationProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    hierarchy: true,
    clickable: false,
  });

  // Get drill-down config from formData.extra_config
  const drillDownConfig: DrillDownConfig = formData.extra_config?.drill_down_config || {
    enabled: false,
    hierarchy: [],
    clickable_columns: [],
  };

  const normalizedColumns =
    columns?.map((col) => ({
      column_name: col.column_name || col.name,
      data_type: col.data_type,
    })) || [];

  const updateDrillDownConfig = (updates: Partial<DrillDownConfig>) => {
    const newConfig = {
      ...drillDownConfig,
      ...updates,
    };
    onChange({
      extra_config: {
        ...formData.extra_config,
        drill_down_config: newConfig,
      },
    });
  };

  const toggleDrillDown = (enabled: boolean) => {
    updateDrillDownConfig({ enabled });
  };

  // Hierarchy Management
  const addHierarchyLevel = () => {
    const newLevel: DrillDownLevel = {
      level: drillDownConfig.hierarchy.length,
      column: '',
      display_name: '',
      aggregation_columns: [],
    };
    updateDrillDownConfig({
      hierarchy: [...drillDownConfig.hierarchy, newLevel],
    });
  };

  const updateHierarchyLevel = (index: number, updates: Partial<DrillDownLevel>) => {
    const updatedHierarchy = drillDownConfig.hierarchy.map((level, i) =>
      i === index ? { ...level, ...updates } : level
    );
    updateDrillDownConfig({ hierarchy: updatedHierarchy });
  };

  const removeHierarchyLevel = (index: number) => {
    const updatedHierarchy = drillDownConfig.hierarchy
      .filter((_, i) => i !== index)
      .map((level, i) => ({ ...level, level: i })); // Re-index levels
    updateDrillDownConfig({ hierarchy: updatedHierarchy });
  };

  // Clickable Columns Management
  const addClickableColumn = () => {
    const newClickable: ClickableColumn = {
      column: '',
      link_type: 'internal',
      url_template: '',
      target: '_self',
    };
    updateDrillDownConfig({
      clickable_columns: [...(drillDownConfig.clickable_columns || []), newClickable],
    });
  };

  const updateClickableColumn = (index: number, updates: Partial<ClickableColumn>) => {
    const updatedClickable = (drillDownConfig.clickable_columns || []).map((col, i) =>
      i === index ? { ...col, ...updates } : col
    );
    updateDrillDownConfig({ clickable_columns: updatedClickable });
  };

  const removeClickableColumn = (index: number) => {
    const updatedClickable = (drillDownConfig.clickable_columns || []).filter(
      (_, i) => i !== index
    );
    updateDrillDownConfig({ clickable_columns: updatedClickable });
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Show loading state if columns are not available yet
  if (!columns && !disabled) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-4">
            <div className="text-sm text-gray-500">Loading columns...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!showConfig) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-gray-600" />
              <span className="text-sm text-gray-600">
                Drill-Down {drillDownConfig.enabled ? '(Enabled)' : '(Disabled)'}
              </span>
              {drillDownConfig.enabled && drillDownConfig.hierarchy.length > 0 && (
                <span className="text-xs text-gray-500">
                  {drillDownConfig.hierarchy.length} levels
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(true)}
              disabled={disabled}
            >
              {drillDownConfig.enabled ? 'Edit Configuration' : 'Configure Drill-Down'}
            </Button>
          </div>
          {drillDownConfig.enabled && drillDownConfig.hierarchy.length > 0 && (
            <div className="mt-3 space-y-1">
              {drillDownConfig.hierarchy.map((level, index) => (
                <div key={index} className="text-xs text-gray-500 bg-gray-50 px-2 py-1 rounded">
                  Level {level.level}: {level.display_name || level.column}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Drill-Down Configuration
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Drill-Down */}
        <div className="flex items-center space-x-2 p-3 border rounded-lg bg-gray-50">
          <Checkbox
            id="enable-drilldown"
            checked={drillDownConfig.enabled}
            onCheckedChange={(checked) => toggleDrillDown(checked as boolean)}
            disabled={disabled}
          />
          <Label htmlFor="enable-drilldown" className="text-sm font-medium cursor-pointer">
            Enable Drill-Down Navigation
          </Label>
        </div>

        {drillDownConfig.enabled && (
          <>
            {/* Hierarchy Configuration */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection('hierarchy')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Hierarchy Levels</span>
                  <span className="text-xs text-gray-500">
                    ({drillDownConfig.hierarchy.length} levels)
                  </span>
                </div>
                {expandedSections.hierarchy ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {expandedSections.hierarchy && (
                <div className="p-3 border-t space-y-3">
                  {drillDownConfig.hierarchy.length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <Layers className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-sm">No hierarchy levels configured</p>
                      <p className="text-xs">Add levels to enable drill-down navigation</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {drillDownConfig.hierarchy.map((level, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-gray-700">
                              Level {level.level}
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeHierarchyLevel(index)}
                              disabled={disabled}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Column Selection */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Column *</Label>
                            <Select
                              value={level.column}
                              onValueChange={(value) =>
                                updateHierarchyLevel(index, { column: value })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                {normalizedColumns.map((col) => (
                                  <SelectItem key={col.column_name} value={col.column_name}>
                                    {col.column_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Display Name */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Display Name *</Label>
                            <Input
                              type="text"
                              placeholder="e.g., State, District, Sub-District"
                              value={level.display_name}
                              onChange={(e) =>
                                updateHierarchyLevel(index, { display_name: e.target.value })
                              }
                              disabled={disabled}
                              className="h-8 text-xs"
                            />
                          </div>

                          {/* Aggregation Columns (Optional) */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">
                              Aggregation Columns (Optional)
                            </Label>
                            <p className="text-xs text-gray-500 mb-2">
                              Select columns to aggregate at this level
                            </p>
                            <div className="max-h-32 overflow-y-auto border rounded p-2 space-y-1">
                              {normalizedColumns.map((col) => {
                                const isSelected = (level.aggregation_columns || []).includes(
                                  col.column_name
                                );
                                return (
                                  <div
                                    key={col.column_name}
                                    className="flex items-center space-x-2"
                                  >
                                    <Checkbox
                                      id={`agg-${index}-${col.column_name}`}
                                      checked={isSelected}
                                      onCheckedChange={(checked) => {
                                        const current = level.aggregation_columns || [];
                                        const updated = checked
                                          ? [...current, col.column_name]
                                          : current.filter((c) => c !== col.column_name);
                                        updateHierarchyLevel(index, {
                                          aggregation_columns: updated,
                                        });
                                      }}
                                      disabled={disabled}
                                    />
                                    <Label
                                      htmlFor={`agg-${index}-${col.column_name}`}
                                      className="text-xs font-normal cursor-pointer"
                                    >
                                      {col.column_name}
                                    </Label>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addHierarchyLevel}
                    disabled={disabled}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Hierarchy Level
                  </Button>
                </div>
              )}
            </div>

            {/* Clickable Columns Configuration */}
            <div className="border rounded-lg">
              <button
                type="button"
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
                onClick={() => toggleSection('clickable')}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Clickable Columns</span>
                  <span className="text-xs text-gray-500">
                    ({(drillDownConfig.clickable_columns || []).length} configured)
                  </span>
                </div>
                {expandedSections.clickable ? (
                  <ChevronUp className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                )}
              </button>

              {expandedSections.clickable && (
                <div className="p-3 border-t space-y-3">
                  {(drillDownConfig.clickable_columns || []).length === 0 ? (
                    <div className="text-center py-6 text-gray-500">
                      <p className="text-sm">No clickable columns configured</p>
                      <p className="text-xs">Make table cells clickable with custom links</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {(drillDownConfig.clickable_columns || []).map((clickable, index) => (
                        <div key={index} className="p-3 border rounded-lg space-y-3 bg-white">
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-medium text-gray-700">
                              Clickable Column {index + 1}
                            </Label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeClickableColumn(index)}
                              disabled={disabled}
                              className="h-6 w-6 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Column Selection */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Column *</Label>
                            <Select
                              value={clickable.column}
                              onValueChange={(value) =>
                                updateClickableColumn(index, { column: value })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select column" />
                              </SelectTrigger>
                              <SelectContent>
                                {normalizedColumns.map((col) => (
                                  <SelectItem key={col.column_name} value={col.column_name}>
                                    {col.column_name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Link Type */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Link Type *</Label>
                            <Select
                              value={clickable.link_type}
                              onValueChange={(value) =>
                                updateClickableColumn(index, {
                                  link_type: value as ClickableColumn['link_type'],
                                })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select link type" />
                              </SelectTrigger>
                              <SelectContent>
                                {LINK_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* URL Template */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">URL Template</Label>
                            <Input
                              type="text"
                              placeholder="/reports/{column_value}"
                              value={clickable.url_template || ''}
                              onChange={(e) =>
                                updateClickableColumn(index, { url_template: e.target.value })
                              }
                              disabled={disabled}
                              className="h-8 text-xs font-mono"
                            />
                            <p className="text-xs text-gray-500">
                              Use {'{column_value}'} as placeholder
                            </p>
                          </div>

                          {/* Target */}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-600">Open Link In</Label>
                            <Select
                              value={clickable.target || '_self'}
                              onValueChange={(value) =>
                                updateClickableColumn(index, {
                                  target: value as '_blank' | '_self',
                                })
                              }
                              disabled={disabled}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_self">Same Tab</SelectItem>
                                <SelectItem value="_blank">New Tab</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addClickableColumn}
                    disabled={disabled}
                    className="w-full"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Clickable Column
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
