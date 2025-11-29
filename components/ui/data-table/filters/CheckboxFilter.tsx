'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PopoverContent } from '@/components/ui/popover';

interface CheckboxFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
  onClear: () => void;
  title: string;
  options: Array<{
    value: string;
    label: string;
  }>;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function CheckboxFilter({
  value,
  onChange,
  onClear,
  title,
  options,
  searchable = false,
  searchPlaceholder = 'Search...',
}: CheckboxFilterProps) {
  const [search, setSearch] = useState('');

  const filteredOptions = useMemo(() => {
    if (!searchable || !search) return options;
    return options.filter((option) => option.label.toLowerCase().includes(search.toLowerCase()));
  }, [options, search, searchable]);

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  return (
    <PopoverContent className="w-64" align="start">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-medium text-sm">{title}</h4>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </Button>
        </div>

        {searchable && (
          <div className="space-y-2">
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8"
            />
          </div>
        )}

        <div className="max-h-48 overflow-y-auto space-y-2">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
                onClick={() => handleToggle(option.value)}
              >
                <Checkbox
                  checked={value.includes(option.value)}
                  onChange={() => {}} // Handled by parent onClick
                />
                <Label className="text-sm cursor-pointer flex-1 text-gray-900">
                  {option.label}
                </Label>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-2">No options found</p>
          )}
        </div>
      </div>
    </PopoverContent>
  );
}
