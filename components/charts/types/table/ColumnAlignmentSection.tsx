'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnAlignment } from './types';

/** Alignment options shown in the dropdown */
const ALIGNMENT_OPTIONS: Array<{ value: 'auto' | ColumnAlignment; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

interface ColumnAlignmentSectionProps {
  columns: string[];
  alignment: Record<string, ColumnAlignment>;
  onChange: (alignment: Record<string, ColumnAlignment>) => void;
  disabled?: boolean;
}

export function ColumnAlignmentSection({
  columns,
  alignment,
  onChange,
  disabled,
}: ColumnAlignmentSectionProps) {
  const handleAlignmentChange = (column: string, value: string) => {
    if (value === 'auto') {
      // Remove override — auto-detect will be used
      const updated = { ...alignment };
      delete updated[column];
      onChange(updated);
    } else {
      onChange({ ...alignment, [column]: value as ColumnAlignment });
    }
  };

  if (columns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Column Alignment</h4>
        <p className="text-sm text-muted-foreground text-center py-2">No columns selected.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Column Alignment</h4>
      <p className="text-xs text-muted-foreground">
        Auto: numbers right-aligned, text left-aligned
      </p>
      <div className="space-y-1">
        {columns.map((column) => (
          <div key={column} className="flex items-center justify-between p-2 rounded-md border">
            <span className="text-sm truncate flex-1 min-w-0 mr-2">{column}</span>
            <Select
              value={alignment[column] || 'auto'}
              onValueChange={(val) => handleAlignmentChange(column, val)}
              disabled={disabled}
            >
              <SelectTrigger data-testid={`alignment-${column}`} className="h-7 w-[90px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALIGNMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
