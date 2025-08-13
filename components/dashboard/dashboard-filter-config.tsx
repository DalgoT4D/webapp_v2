'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  X,
  Filter,
  Settings,
  GripVertical,
  Edit,
  Trash2,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import useSWR, { mutate } from 'swr';

interface DashboardFilter {
  id?: number;
  dashboard_id?: number;
  filter_type: 'value' | 'numerical';
  schema_name: string;
  table_name: string;
  column_name: string;
  settings: {
    label?: string;
    defaultValue?: any;
    multiSelect?: boolean;
    isRange?: boolean;
    min?: number;
    max?: number;
    step?: number;
  };
  order: number;
}

interface DashboardFilterConfigProps {
  dashboardId: number;
  filters: DashboardFilter[];
  onFiltersChange: (filters: DashboardFilter[]) => void;
}

export function DashboardFilterConfig({
  dashboardId,
  filters,
  onFiltersChange,
}: DashboardFilterConfigProps) {
  const [isAddFilterOpen, setIsAddFilterOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<DashboardFilter | null>(null);
  const [localFilters, setLocalFilters] = useState<DashboardFilter[]>(filters || []);

  useEffect(() => {
    setLocalFilters(filters || []);
  }, [filters]);

  const handleAddFilter = (filter: DashboardFilter) => {
    const newFilter = {
      ...filter,
      order: localFilters.length,
    };
    const updatedFilters = [...localFilters, newFilter];
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
    setIsAddFilterOpen(false);
  };

  const handleUpdateFilter = (index: number, filter: DashboardFilter) => {
    const updatedFilters = [...localFilters];
    updatedFilters[index] = filter;
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
    setEditingFilter(null);
  };

  const handleRemoveFilter = (index: number) => {
    const updatedFilters = localFilters.filter((_, i) => i !== index);
    // Reorder remaining filters
    updatedFilters.forEach((filter, i) => {
      filter.order = i;
    });
    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  const handleReorderFilter = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= localFilters.length) return;

    const updatedFilters = [...localFilters];
    [updatedFilters[index], updatedFilters[newIndex]] = [
      updatedFilters[newIndex],
      updatedFilters[index],
    ];

    // Update order values
    updatedFilters.forEach((filter, i) => {
      filter.order = i;
    });

    setLocalFilters(updatedFilters);
    onFiltersChange(updatedFilters);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Dashboard Filters</h3>
          {localFilters.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {localFilters.length}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsAddFilterOpen(true)}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Filter
        </Button>
      </div>

      {localFilters.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-6 text-center">
            <Filter className="h-8 w-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-3">No filters configured</p>
            <Button variant="outline" size="sm" onClick={() => setIsAddFilterOpen(true)}>
              <Plus className="h-3 w-3 mr-1" />
              Add Your First Filter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {localFilters.map((filter, index) => (
            <Card key={index} className="group">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <GripVertical className="h-4 w-4 text-muted-foreground cursor-move" />

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={filter.filter_type === 'value' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {filter.filter_type === 'value' ? 'Categorical' : 'Numerical'}
                      </Badge>
                      <span className="text-sm font-medium">
                        {filter.settings?.label || filter.column_name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({filter.schema_name}.{filter.table_name}.{filter.column_name})
                      </span>
                    </div>
                    {filter.settings && (
                      <div className="flex items-center gap-2 mt-1">
                        {filter.filter_type === 'value' && filter.settings.multiSelect && (
                          <Badge variant="outline" className="text-xs">
                            Multi-select
                          </Badge>
                        )}
                        {filter.filter_type === 'numerical' && filter.settings.isRange && (
                          <Badge variant="outline" className="text-xs">
                            Range: {filter.settings.min} - {filter.settings.max}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReorderFilter(index, 'up')}
                      disabled={index === 0}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReorderFilter(index, 'down')}
                      disabled={index === localFilters.length - 1}
                      className="h-7 w-7 p-0"
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingFilter(filter)}
                      className="h-7 w-7 p-0"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveFilter(index)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Filter Dialog */}
      <FilterEditDialog
        open={isAddFilterOpen}
        onOpenChange={setIsAddFilterOpen}
        filter={null}
        dashboardId={dashboardId}
        onSave={handleAddFilter}
      />

      {/* Edit Filter Dialog */}
      {editingFilter && (
        <FilterEditDialog
          open={!!editingFilter}
          onOpenChange={(open) => !open && setEditingFilter(null)}
          filter={editingFilter}
          dashboardId={dashboardId}
          onSave={(filter) => {
            const index = localFilters.findIndex((f) => f === editingFilter);
            if (index !== -1) {
              handleUpdateFilter(index, filter);
            }
          }}
        />
      )}
    </div>
  );
}

// Filter Edit Dialog Component
function FilterEditDialog({
  open,
  onOpenChange,
  filter,
  dashboardId,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filter: DashboardFilter | null;
  dashboardId: number;
  onSave: (filter: DashboardFilter) => void;
}) {
  const [filterData, setFilterData] = useState<DashboardFilter>(
    filter || {
      filter_type: 'value',
      schema_name: '',
      table_name: '',
      column_name: '',
      settings: {
        label: '',
        multiSelect: false,
        isRange: true,
        min: 0,
        max: 100,
        step: 1,
      },
      order: 0,
    }
  );

  // Fetch available schemas, tables, and columns
  // This would need to be implemented based on your backend API
  const schemas = ['public', 'analytics']; // Mock data
  const tables = ['sales', 'customers', 'products']; // Mock data
  const columns = ['region', 'category', 'amount', 'quantity']; // Mock data

  const handleSave = () => {
    onSave(filterData);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{filter ? 'Edit Filter' : 'Add Filter'}</DialogTitle>
          <DialogDescription>Configure a filter for your dashboard</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs
            value={filterData.filter_type}
            onValueChange={(value) =>
              setFilterData({ ...filterData, filter_type: value as 'value' | 'numerical' })
            }
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="value">Categorical</TabsTrigger>
              <TabsTrigger value="numerical">Numerical</TabsTrigger>
            </TabsList>

            <TabsContent value="value" className="space-y-4">
              <div className="space-y-2">
                <Label>Display Label</Label>
                <Input
                  value={filterData.settings?.label || ''}
                  onChange={(e) =>
                    setFilterData({
                      ...filterData,
                      settings: { ...filterData.settings, label: e.target.value },
                    })
                  }
                  placeholder="e.g., Region, Category"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Allow Multiple Selection</Label>
                <Switch
                  checked={filterData.settings?.multiSelect || false}
                  onCheckedChange={(checked) =>
                    setFilterData({
                      ...filterData,
                      settings: { ...filterData.settings, multiSelect: checked },
                    })
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="numerical" className="space-y-4">
              <div className="space-y-2">
                <Label>Display Label</Label>
                <Input
                  value={filterData.settings?.label || ''}
                  onChange={(e) =>
                    setFilterData({
                      ...filterData,
                      settings: { ...filterData.settings, label: e.target.value },
                    })
                  }
                  placeholder="e.g., Price, Quantity"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label>Range Filter</Label>
                <Switch
                  checked={filterData.settings?.isRange ?? true}
                  onCheckedChange={(checked) =>
                    setFilterData({
                      ...filterData,
                      settings: { ...filterData.settings, isRange: checked },
                    })
                  }
                />
              </div>

              {filterData.settings?.isRange && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input
                        type="number"
                        value={filterData.settings?.min || 0}
                        onChange={(e) =>
                          setFilterData({
                            ...filterData,
                            settings: {
                              ...filterData.settings,
                              min: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input
                        type="number"
                        value={filterData.settings?.max || 100}
                        onChange={(e) =>
                          setFilterData({
                            ...filterData,
                            settings: {
                              ...filterData.settings,
                              max: Number(e.target.value),
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Step</Label>
                    <Input
                      type="number"
                      value={filterData.settings?.step || 1}
                      onChange={(e) =>
                        setFilterData({
                          ...filterData,
                          settings: {
                            ...filterData.settings,
                            step: Number(e.target.value),
                          },
                        })
                      }
                    />
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schema</Label>
              <Select
                value={filterData.schema_name}
                onValueChange={(value) => setFilterData({ ...filterData, schema_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select schema" />
                </SelectTrigger>
                <SelectContent>
                  {schemas.map((schema) => (
                    <SelectItem key={schema} value={schema}>
                      {schema}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Table</Label>
              <Select
                value={filterData.table_name}
                onValueChange={(value) => setFilterData({ ...filterData, table_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select table" />
                </SelectTrigger>
                <SelectContent>
                  {tables.map((table) => (
                    <SelectItem key={table} value={table}>
                      {table}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Column</Label>
              <Select
                value={filterData.column_name}
                onValueChange={(value) => setFilterData({ ...filterData, column_name: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!filterData.schema_name || !filterData.table_name || !filterData.column_name}
          >
            {filter ? 'Update' : 'Add'} Filter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
