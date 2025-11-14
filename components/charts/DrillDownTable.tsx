'use client';

import { useState, useEffect } from 'react';
import { Download, RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { apiPost } from '@/lib/api';
import { TableChart } from './TableChart';
import { DrillDownBreadcrumb } from './DrillDownBreadcrumb';
import type {
  DrillDownConfig,
  DrillDownPathStep,
  DrillDownState,
  ChartFilter,
} from '@/types/charts';

interface DrillDownTableProps {
  chartId: number;
  config: DrillDownConfig;
  initialFilters?: ChartFilter[];
  className?: string;
}

export function DrillDownTable({
  chartId,
  config,
  initialFilters = [],
  className,
}: DrillDownTableProps) {
  const [state, setState] = useState<DrillDownState>({
    currentLevel: 0,
    drillPath: [],
    data: [],
    isLoading: false,
  });

  // Fetch data for current drill-down level
  const fetchDrillDownData = async (level: number, path: DrillDownPathStep[]) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await apiPost(`/api/charts/${chartId}/data/`, {
        drill_down_level: level,
        drill_down_path: path,
        extra_config: {
          filters: initialFilters,
          pagination: { enabled: true, page_size: 100 },
        },
        offset: 0,
        limit: 100,
      });

      // Extract data from response
      // Response structure varies by chart type, but for tables it should be in data.data
      const tableData = response.data?.data || response.data || [];

      setState({
        currentLevel: level,
        drillPath: path,
        data: Array.isArray(tableData) ? tableData : [],
        isLoading: false,
      });
    } catch (error: any) {
      console.error('Error fetching drill-down data:', error);
      toast.error(`Failed to fetch data: ${error.message || 'Unknown error'}`);
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  };

  // Load initial data on mount
  useEffect(() => {
    fetchDrillDownData(0, []);
  }, [chartId]);

  // Handle row double-click for drill-down
  const handleRowDoubleClick = (row: Record<string, any>) => {
    const { currentLevel, drillPath } = state;
    const levelConfig = config.hierarchy[currentLevel];

    if (!levelConfig) {
      toast.error('No drill-down level configured');
      return;
    }

    // Check if we've reached max depth
    if (currentLevel >= config.hierarchy.length - 1) {
      toast.info('Maximum drill-down depth reached');
      return;
    }

    const columnValue = row[levelConfig.column];

    if (columnValue === null || columnValue === undefined) {
      toast.error(`Cannot drill down: ${levelConfig.column} value is empty`);
      return;
    }

    // Add to drill path
    const newPath: DrillDownPathStep[] = [
      ...drillPath,
      {
        level: currentLevel,
        column: levelConfig.column,
        value: columnValue,
        display_name: levelConfig.display_name,
      },
    ];

    // Fetch next level data
    fetchDrillDownData(currentLevel + 1, newPath);
  };

  // Handle breadcrumb click to navigate back
  const handleBreadcrumbClick = (level: number) => {
    if (level === state.currentLevel) return; // Already at this level

    // Truncate drill path to the clicked level
    const newPath = state.drillPath.slice(0, level);

    fetchDrillDownData(level, newPath);
  };

  // Handle reset to top level
  const handleReset = () => {
    if (state.currentLevel === 0 && state.drillPath.length === 0) return;
    fetchDrillDownData(0, []);
  };

  // Handle CSV export
  const handleExportCSV = async () => {
    try {
      // Build filename from breadcrumb path
      const pathText = state.drillPath.map((step) => step.value).join('_');
      const filename = `drill_down_${pathText || 'all'}_${new Date().toISOString().split('T')[0]}.csv`;

      // Export current view data as CSV
      const { ChartExporter } = await import('@/lib/chart-export');

      // Get column names from data
      const columns = state.data.length > 0 ? Object.keys(state.data[0]) : [];

      await ChartExporter.exportTableAsCSV({ data: state.data, columns }, { filename });

      toast.success('CSV exported successfully');
    } catch (error: any) {
      console.error('Error exporting CSV:', error);
      toast.error(`Failed to export CSV: ${error.message || 'Unknown error'}`);
    }
  };

  return (
    <div className={className}>
      {/* Breadcrumb Navigation */}
      {state.drillPath.length > 0 && (
        <DrillDownBreadcrumb
          path={state.drillPath}
          config={config}
          onLevelClick={handleBreadcrumbClick}
        />
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {state.currentLevel < config.hierarchy.length - 1 && (
            <p className="text-sm text-gray-600">
              Double-click a row to drill down to{' '}
              {config.hierarchy[state.currentLevel + 1]?.display_name}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={state.currentLevel === 0 || state.isLoading}
          >
            <RotateCcw className="h-4 w-4 mr-1" />
            Reset
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={state.data.length === 0 || state.isLoading}
          >
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Loading State */}
      {state.isLoading && (
        <div className="flex items-center justify-center p-12 border rounded-lg bg-gray-50">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
          <span className="text-gray-600">Loading data...</span>
        </div>
      )}

      {/* Table */}
      {!state.isLoading && (
        <TableChart
          data={state.data}
          config={{
            pagination: { enabled: false, page_size: 100 },
          }}
          onRowDoubleClick={handleRowDoubleClick}
          drillDownEnabled={state.currentLevel < config.hierarchy.length - 1}
          isLoading={state.isLoading}
        />
      )}

      {/* Empty State */}
      {!state.isLoading && state.data.length === 0 && (
        <div className="flex items-center justify-center p-12 border rounded-lg bg-gray-50">
          <p className="text-gray-600">No data available</p>
        </div>
      )}
    </div>
  );
}
