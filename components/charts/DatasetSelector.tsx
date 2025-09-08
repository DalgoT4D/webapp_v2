'use client';

import React, { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Search, Database, ChevronDown } from 'lucide-react';
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);

  // Current selected value for display
  const selectedFullName = schema_name && table_name ? `${schema_name}.${table_name}` : '';

  // Update hasSelection when props change
  React.useEffect(() => {
    setHasSelection(!!selectedFullName);
  }, [selectedFullName]);

  // Filter tables based on search query
  const filteredTables = allTables?.filter((table) => {
    if (!searchQuery.trim() && !hasSelection) return true;
    const query = searchQuery.toLowerCase();
    return (
      table.schema_name.toLowerCase().includes(query) ||
      table.table_name.toLowerCase().includes(query) ||
      table.full_name.toLowerCase().includes(query)
    );
  });

  const handleTableSelect = (fullName: string) => {
    if (!fullName) return;

    // Split the full name to get schema and table
    const [schema, table] = fullName.split('.');
    if (schema && table) {
      onDatasetChange(schema, table);
      setSearchQuery('');
      setIsDropdownOpen(false);
      setHasSelection(true);
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="p-4 bg-red-50 rounded-lg border border-red-200">
          <Label className="text-red-600">Datasets need attention</Label>
          <p className="text-sm text-red-500">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Container with grey background */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <Label htmlFor="dataset" className="text-sm font-medium text-gray-900 mb-2 block">
          Dataset
        </Label>

        {/* Search input matching chart creation style */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 z-10" />
            <Input
              placeholder={isLoading ? 'Loading datasets...' : 'Search and select a dataset...'}
              value={hasSelection && !searchQuery ? selectedFullName : searchQuery}
              onChange={(e) => {
                const value = e.target.value;
                setSearchQuery(value);
                setIsDropdownOpen(true);
                // Clear selection when user starts typing
                if (hasSelection && value !== selectedFullName) {
                  setHasSelection(false);
                }
              }}
              className="pl-10 h-10 text-base w-full"
              disabled={disabled || isLoading}
              onFocus={() => {
                setIsDropdownOpen(true);
              }}
              onBlur={() => {
                // Delay closing to allow clicking on dropdown items
                setTimeout(() => setIsDropdownOpen(false), 150);
              }}
            />
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          </div>

          {/* Dropdown Results matching chart creation style */}
          {isDropdownOpen && (!hasSelection || searchQuery) && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-64 overflow-auto">
              {isLoading ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  Loading datasets from all schemas...
                </div>
              ) : filteredTables?.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500">
                  {searchQuery ? 'No datasets match your search' : 'No datasets available'}
                </div>
              ) : (
                filteredTables?.map((table) => (
                  <div
                    key={table.full_name}
                    className="flex items-center gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 w-full"
                    onClick={() => handleTableSelect(table.full_name)}
                  >
                    <Database className="w-4 h-4 text-gray-500 flex-shrink-0" />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-mono text-sm font-medium text-gray-900 truncate">
                        {table.full_name}
                      </span>
                      <span className="text-xs text-gray-500 truncate">
                        Schema: {table.schema_name} • Table: {table.table_name}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
