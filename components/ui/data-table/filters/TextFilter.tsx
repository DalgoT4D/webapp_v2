'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { PopoverContent } from '@/components/ui/popover';
import { TextFilterValue } from '../types';

interface TextFilterProps {
  value: TextFilterValue;
  onChange: (value: TextFilterValue) => void;
  onClear: () => void;
  title: string;
  placeholder?: string;
  checkboxOptions?: Array<{
    key: string;
    label: string;
  }>;
}

export function TextFilter({
  value,
  onChange,
  onClear,
  title,
  placeholder = 'Search...',
  checkboxOptions = [],
}: TextFilterProps) {
  return (
    <PopoverContent className="w-80" align="start">
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

        <div className="space-y-2">
          <Input
            placeholder={placeholder}
            value={value.text || ''}
            onChange={(e) => onChange({ ...value, text: e.target.value })}
            className="h-8"
          />
        </div>

        {checkboxOptions.length > 0 && (
          <div className="space-y-3">
            {checkboxOptions.map((option) => (
              <div key={option.key} className="flex items-center space-x-2">
                <Checkbox
                  id={option.key}
                  checked={(value as unknown as Record<string, boolean>)[option.key] || false}
                  onCheckedChange={(checked) =>
                    onChange({ ...value, [option.key]: checked as boolean })
                  }
                />
                <Label htmlFor={option.key} className="text-sm cursor-pointer">
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
        )}
      </div>
    </PopoverContent>
  );
}
