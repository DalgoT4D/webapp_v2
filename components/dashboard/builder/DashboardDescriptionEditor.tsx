'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';

// Max length for the dashboard description (keeps the header compact).
export const DESCRIPTION_MAX_LENGTH = 100;

/**
 * Compact description trigger in the header that opens an anchored popover with
 * a full textarea. Save commits (caller persists via onSave); Escape / outside
 * click reverts to the pre-edit value.
 */
export function DashboardDescriptionEditor({
  value,
  onChange,
  onSave,
  testId,
}: {
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  testId: string;
}) {
  const [open, setOpen] = useState(false);
  // Snapshot captured when the popover opens, used to revert on dismiss
  const snapshotRef = useRef(value);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      snapshotRef.current = value;
    } else {
      // Dismissed without an explicit Save -> revert unsaved edits
      onChange(snapshotRef.current);
    }
    setOpen(next);
  };

  const handleSave = () => {
    setOpen(false);
    onSave();
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="text-left rounded px-2 py-0.5 hover:bg-gray-50 max-w-full"
          data-testid={`${testId}-display`}
        >
          {value ? (
            <span className="block truncate text-xs text-gray-600">{value}</span>
          ) : (
            <span className="text-xs text-gray-400 italic">+ Add description</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${testId}-input`} className="text-sm font-medium">
            Dashboard description
          </Label>
          <Textarea
            id={`${testId}-input`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Describe what this dashboard shows (optional)..."
            className="h-24 resize-none text-sm"
            maxLength={DESCRIPTION_MAX_LENGTH}
            autoFocus
            data-testid={`${testId}-input`}
            onKeyDown={(e) => {
              // Cmd/Ctrl+Enter saves; Escape is handled by the Popover (reverts)
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                handleSave();
              }
            }}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400">
              {value.length}/{DESCRIPTION_MAX_LENGTH}
            </span>
            <Button size="sm" onClick={handleSave} data-testid={`${testId}-save`}>
              Save
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
