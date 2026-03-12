'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import type { ChartPagination, ChartBuilderFormData } from '@/types/charts';

interface ChartPaginationConfigurationProps {
  formData: ChartBuilderFormData;
  onChange: (updates: Partial<ChartBuilderFormData>) => void;
  disabled?: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200, 500];

export function ChartPaginationConfiguration({
  formData,
  onChange,
  disabled = false,
}: ChartPaginationConfigurationProps) {
  const [showConfig, setShowConfig] = useState(false);

  const pagination = formData.pagination || { enabled: false, page_size: 50 };

  const updatePagination = (updates: Partial<ChartPagination>) => {
    onChange({
      pagination: {
        ...pagination,
        ...updates,
      },
    });
  };

  const togglePagination = (enabled: boolean) => {
    updatePagination({ enabled });
  };

  if (!showConfig) {
    return (
      <Card className="border-dashed">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <ChevronLeft className="h-3 w-3 text-gray-400" />
                <MoreHorizontal className="h-3 w-3 text-gray-400" />
                <ChevronRight className="h-3 w-3 text-gray-400" />
              </div>
              <span className="text-sm text-gray-600">
                Pagination: {pagination.enabled ? `${pagination.page_size} per page` : 'Disabled'}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowConfig(true)}
              disabled={disabled}
            >
              {pagination.enabled ? 'Edit Pagination' : 'Enable Pagination'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              <MoreHorizontal className="h-4 w-4" />
              <ChevronRight className="h-4 w-4" />
            </div>
            Chart Pagination
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setShowConfig(false)}>
            Done
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Switch */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label className="text-sm font-medium">Enable Pagination</Label>
            <p className="text-xs text-gray-600">Limit the number of data points shown at once</p>
          </div>
          <Switch
            checked={pagination.enabled}
            onCheckedChange={togglePagination}
            disabled={disabled}
          />
        </div>

        {/* Page Size Configuration */}
        {pagination.enabled && (
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Items per Page</Label>
              <Select
                value={pagination.page_size.toString()}
                onValueChange={(value) => updatePagination({ page_size: parseInt(value) })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <SelectItem key={size} value={size.toString()}>
                      {size} items
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Page Size */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom Page Size</Label>
              <Input
                type="number"
                min="1"
                max="10000"
                placeholder="Enter custom size"
                value={
                  PAGE_SIZE_OPTIONS.includes(pagination.page_size)
                    ? ''
                    : pagination.page_size.toString()
                }
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value > 0) {
                    updatePagination({ page_size: value });
                  }
                }}
                disabled={disabled}
              />
              <p className="text-xs text-gray-500">Enter a value between 1 and 10,000</p>
            </div>

            {/* Preview */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-2">Preview:</p>
              <div className="flex items-center gap-2 text-xs">
                <Button variant="outline" size="sm" disabled className="h-6 px-2">
                  ← Previous
                </Button>
                <span className="text-gray-600">
                  Showing 1-{pagination.page_size} of {pagination.page_size * 3} items
                </span>
                <Button variant="outline" size="sm" disabled className="h-6 px-2">
                  Next →
                </Button>
              </div>
            </div>

            {/* Help Text */}
            <div className="text-xs text-gray-500 space-y-1">
              <p>• Pagination helps improve chart performance with large datasets</p>
              <p>• Users can navigate through data using pagination controls</p>
              <p>• Smaller page sizes load faster but require more navigation</p>
            </div>
          </div>
        )}

        {!pagination.enabled && (
          <div className="text-center py-6 text-gray-500">
            <div className="flex items-center justify-center gap-1 mb-2">
              <ChevronLeft className="h-6 w-6 text-gray-400" />
              <MoreHorizontal className="h-6 w-6 text-gray-400" />
              <ChevronRight className="h-6 w-6 text-gray-400" />
            </div>
            <p className="text-sm">Pagination is disabled</p>
            <p className="text-xs">All data will be shown at once</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
