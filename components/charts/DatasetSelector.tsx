'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Search, ChevronDown } from 'lucide-react';
import { useAllSchemaTables } from '@/hooks/api/useChart';

interface DatasetSelectorProps {
  schema_name?: string;
  table_name?: string;
  onDatasetChange: (schema_name: string, table_name: string) => void;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
}

// Helper function to highlight search text in results
const highlightText = (text: string, searchQuery: string) => {
  if (!searchQuery.trim()) return text;

  const regex = new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark key={index} className="bg-yellow-200 text-yellow-900 font-medium">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

export function DatasetSelector({
  schema_name,
  table_name,
  onDatasetChange,
  disabled,
  className,
  autoFocus = false,
}: DatasetSelectorProps) {
  const { data: allTables, isLoading, error } = useAllSchemaTables();
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(autoFocus);
  const inputRef = useRef<HTMLInputElement>(null);

  // Current selected value for display
  const selectedFullName = schema_name && table_name ? `${schema_name}.${table_name}` : '';

  // Auto-focus the input when autoFocus is enabled
  useEffect(() => {
    if (autoFocus && inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [autoFocus, isLoading]);

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

  const handleTableSelect = (fullName: string) => {
    if (!fullName) return;

    // Split the full name to get schema and table
    const [schema, table] = fullName.split('.');
    if (schema && table) {
      onDatasetChange(schema, table);
      setSearchQuery('');
      setIsDropdownOpen(false);
    }
  };

  if (error) {
    return (
      <div className={className}>
        <div className="p-3 bg-red-50 rounded border border-red-200 text-sm text-red-600">
          Failed to load datasets. Please try refreshing.
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10" />
        <Input
          ref={inputRef}
          placeholder={isLoading ? 'Loading...' : 'Search datasets...'}
          value={!isDropdownOpen && selectedFullName ? selectedFullName : searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          className="pl-9 pr-8 h-10 w-full bg-white"
          disabled={disabled || isLoading}
          onFocus={() => {
            setIsDropdownOpen(true);
            // Clear search to show all options when focusing on selected value
            if (selectedFullName && !searchQuery) {
              setSearchQuery('');
            }
          }}
          onBlur={() => {
            // Delay closing to allow clicking on dropdown items
            setTimeout(() => setIsDropdownOpen(false), 150);
          }}
        />
        <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />

        {/* Simple dropdown */}
        {isDropdownOpen && (
          <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-auto">
            {isLoading ? (
              <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
            ) : filteredTables?.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">
                {searchQuery ? 'No datasets found' : 'No datasets available'}
              </div>
            ) : (
              filteredTables?.map((table) => {
                const isSelected = table.full_name === selectedFullName;
                return (
                  <div
                    key={table.full_name}
                    className={`px-3 py-2 cursor-pointer text-sm border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => handleTableSelect(table.full_name)}
                  >
                    <div className="font-mono font-medium">
                      {highlightText(table.full_name, searchQuery)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
