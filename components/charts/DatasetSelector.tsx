'use client';

import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useAllSchemaTables } from '@/hooks/api/useChart';

interface DatasetSelectorProps {
  schema_name?: string;
  table_name?: string;
  onDatasetChange: (schema_name: string, table_name: string) => void;
  disabled?: boolean;
  className?: string;
}

export function DatasetSelector({
  schema_name,
  table_name,
  onDatasetChange,
  disabled,
  className,
}: DatasetSelectorProps) {
  const { data: allTables, isLoading, error } = useAllSchemaTables();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter tables based on search query
  const filteredTables = allTables?.filter((table) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      table.schema_name.toLowerCase().includes(query) ||
      table.table_name.toLowerCase().includes(query) ||
      table.full_name.toLowerCase().includes(query)
    );
  });

  // Current selected value for the dropdown
  const currentValue = schema_name && table_name ? `${schema_name}.${table_name}` : '';

  const handleDatasetChange = (fullName: string) => {
    if (!fullName) return;

    // Split the full name to get schema and table
    const [schema, table] = fullName.split('.');
    if (schema && table) {
      onDatasetChange(schema, table);
    }
  };

  if (error) {
    return (
      <div className={className}>
        <Label className="text-red-600">Error loading datasets</Label>
        <p className="text-sm text-red-500">Please try refreshing the page</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="space-y-2">
        <Label htmlFor="dataset">Dataset</Label>
        <div className="space-y-2">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              disabled={disabled || isLoading}
            />
          </div>

          {/* Dataset selector */}
          <Select
            value={currentValue}
            onValueChange={handleDatasetChange}
            disabled={disabled || isLoading}
          >
            <SelectTrigger id="dataset">
              <SelectValue placeholder={isLoading ? 'Loading datasets...' : 'Select a dataset'} />
            </SelectTrigger>
            <SelectContent>
              {filteredTables?.length === 0 ? (
                <div className="p-2 text-sm text-gray-500 text-center">
                  {searchQuery ? 'No datasets match your search' : 'No datasets available'}
                </div>
              ) : (
                filteredTables?.map((table) => (
                  <SelectItem key={table.full_name} value={table.full_name}>
                    <div className="flex flex-col">
                      <span className="font-medium">{table.full_name}</span>
                      <span className="text-xs text-gray-500">
                        {table.schema_name} • {table.table_name}
                      </span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Show current selection details */}
        {schema_name && table_name && (
          <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border">
            Schema: <span className="font-mono">{schema_name}</span> • Table:{' '}
            <span className="font-mono">{table_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}
