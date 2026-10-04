'use client';

import type { ReactNode } from 'react';
import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface ColumnFilterPopoverProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Teal icon + dot on the trigger. */
  isActive: boolean;
  triggerTestId: string;
  /** Heading inside the popover, e.g. "Filter by Name". */
  title: string;
  onClear: () => void;
  clearTestId: string;
  /** Popover width class, e.g. "w-80". */
  contentClassName: string;
  /** The filter controls under the heading. */
  children: ReactNode;
}

function FilterIcon({ isActive }: { isActive: boolean }) {
  return (
    <div className="relative">
      <Filter
        className={cn(
          'w-4 h-4 transition-colors',
          isActive ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
        )}
      />
      {isActive && <div className="absolute -top-1 -right-1 w-2 h-2 bg-teal-600 rounded-full" />}
    </div>
  );
}

/** Funnel button in a list header + the popover shell (title, Clear, controls). */
export function ColumnFilterPopover({
  isOpen,
  onOpenChange,
  isActive,
  triggerTestId,
  title,
  onClear,
  clearTestId,
  contentClassName,
  children,
}: ColumnFilterPopoverProps) {
  return (
    <Popover open={isOpen} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 p-0 hover:bg-gray-100"
          data-testid={triggerTestId}
        >
          <FilterIcon isActive={isActive} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={contentClassName} align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm">{title}</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              data-testid={clearTestId}
              className="h-auto p-1 text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </Button>
          </div>
          {children}
        </div>
      </PopoverContent>
    </Popover>
  );
}
