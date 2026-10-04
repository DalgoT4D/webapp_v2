'use client';

import { Label } from '@/components/ui/label';
import { DatasetSelector } from '@/components/charts/DatasetSelector';

interface DataSourceSectionProps {
  schemaName?: string;
  tableName?: string;
  onDatasetChange: (schemaName: string, tableName: string) => void;
  disabled?: boolean;
}

/** "Data Source" label + dataset picker, shared by the chart and map data panels. */
export function DataSourceSection({
  schemaName,
  tableName,
  onDatasetChange,
  disabled,
}: DataSourceSectionProps) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-900">Data Source</Label>
      <DatasetSelector
        schema_name={schemaName}
        table_name={tableName}
        onDatasetChange={onDatasetChange}
        disabled={disabled}
        className="w-full"
        id="chart-dataset-select"
      />
    </div>
  );
}
