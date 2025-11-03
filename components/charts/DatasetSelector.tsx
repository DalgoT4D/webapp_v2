'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const isSelectingRef = useRef(false); // Flag to prevent close during selection

  // Current selected value for display
  const selectedFullName = schema_name && table_name ? `${schema_name}.${table_name}` : '';

  // Auto-focus the input when autoFocus is enabled
  useEffect(() => {
    if (autoFocus && inputRef.current && !isLoading) {
      inputRef.current.focus();
    }
  }, [autoFocus, isLoading]);

  // Calculate dropdown position when it opens
  useEffect(() => {
    const updatePosition = () => {
      if (containerRef.current && isDropdownOpen) {
        const rect = containerRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom, // position: fixed uses viewport coordinates
          left: rect.left, // no need for scrollY/scrollX
          width: rect.width,
        });
      }
    };

    if (isDropdownOpen) {
      updatePosition();
      // Update position on scroll or resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);
      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isDropdownOpen]);

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

  const handleTableSelect = (schema: string, table: string) => {
    console.log('🎯 handleTableSelect called:', { schema, table });

    if (!schema || !table) {
      console.error('❌ Missing schema or table:', { schema, table });
      return;
    }

    // Call parent callback
    console.log('📞 Calling onDatasetChange...');
    onDatasetChange(schema, table);

    // Clean up local state
    setSearchQuery('');
    setIsDropdownOpen(false);

    // Reset the selecting flag after selection completes
    setTimeout(() => {
      isSelectingRef.current = false;
    }, 0);

    console.log('✅ Selection complete');
  };

  // Attach native click handlers to dropdown items (Portal event fix)
  useEffect(() => {
    if (!isDropdownOpen || !dropdownRef.current) return;

    const handleItemClick = (event: Event) => {
      const target = event.target as HTMLElement;
      const item = target.closest('.dataset-item') as HTMLElement;

      if (item) {
        console.log('🖱️ Native click detected on item');
        event.preventDefault();
        event.stopPropagation();

        const schema = item.getAttribute('data-schema');
        const table = item.getAttribute('data-table');

        console.log('📦 Extracted data:', { schema, table });

        if (schema && table) {
          isSelectingRef.current = true;
          handleTableSelect(schema, table);
        }
      }
    };

    const dropdown = dropdownRef.current;
    console.log('🔧 Attaching native click listener to dropdown');
    dropdown.addEventListener('click', handleItemClick, true);

    return () => {
      console.log('🧹 Cleaning up click listener');
      dropdown.removeEventListener('click', handleItemClick, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDropdownOpen, filteredTables]);

  // Close dropdown when clicking outside (both input and dropdown)
  useEffect(() => {
    if (!isDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      // Don't close if we're in the middle of selecting an item
      if (isSelectingRef.current) {
        return;
      }

      const target = event.target as Node;
      const clickedInside =
        (containerRef.current && containerRef.current.contains(target)) ||
        (dropdownRef.current && dropdownRef.current.contains(target));

      if (!clickedInside) {
        setIsDropdownOpen(false);
      }
    };

    // Use a longer delay to ensure Portal has rendered and ref is attached
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

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
    <div className={className} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 z-10 pointer-events-none" />
        <Input
          ref={inputRef}
          placeholder={isLoading ? 'Loading...' : 'Search datasets...'}
          value={!isDropdownOpen && selectedFullName ? selectedFullName : searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsDropdownOpen(true);
          }}
          className="pl-9 pr-8 h-10 w-full bg-white cursor-pointer"
          disabled={disabled || isLoading}
          onClick={() => {
            if (!isDropdownOpen) {
              setIsDropdownOpen(true);
            }
          }}
          onFocus={() => {
            setIsDropdownOpen(true);
            // Clear search to show all options when focusing on selected value
            if (selectedFullName && !searchQuery) {
              setSearchQuery('');
            }
          }}
        />
        <ChevronDown
          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 cursor-pointer"
          onClick={() => {
            if (!disabled && !isLoading) {
              setIsDropdownOpen(!isDropdownOpen);
              inputRef.current?.focus();
            }
          }}
        />
      </div>

      {/* Dropdown rendered as Portal to escape Dialog overflow constraints */}
      {isDropdownOpen &&
        !disabled &&
        !isLoading &&
        typeof window !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className="fixed bg-white border border-gray-200 rounded shadow-lg max-h-60 overflow-auto"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
              marginTop: '4px',
              zIndex: 99999,
              pointerEvents: 'auto', // Ensure events work
            }}
          >
            {isLoading ? (
              <div className="p-3 text-center text-sm text-gray-500">Loading...</div>
            ) : filteredTables?.length === 0 ? (
              <div className="p-3 text-center text-sm text-gray-500">
                {searchQuery ? 'No datasets found' : 'No datasets available'}
              </div>
            ) : (
              filteredTables?.map((tableItem) => {
                const isSelected = tableItem.full_name === selectedFullName;
                return (
                  <div
                    key={tableItem.full_name}
                    data-schema={tableItem.schema_name}
                    data-table={tableItem.table_name}
                    className={`dataset-item px-3 py-2 cursor-pointer text-sm border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-blue-50 text-blue-900' : 'hover:bg-gray-50'
                    }`}
                    style={{ userSelect: 'none' }}
                  >
                    <div className="font-mono font-medium" style={{ pointerEvents: 'none' }}>
                      {highlightText(tableItem.full_name, searchQuery)}
                    </div>
                  </div>
                );
              })
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
