// components/transform/canvas/panels/OperationList.tsx
'use client';

import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { operations, OPS_REQUIRING_TABLE_FIRST } from '@/constants/transform';
import type { UIOperationType } from '@/types/transform';
import { cn } from '@/lib/utils';

interface OperationListProps {
  /** Callback when an operation is selected */
  onSelect: (operation: UIOperationType) => void;
  /** Whether operations that can't chain in middle should be enabled */
  canChainInMiddle: boolean;
}

/**
 * List of all available operations with info tooltips.
 * Some operations are disabled when chaining from an operation node
 * (they require starting from a source/model node).
 */
export function OperationList({ onSelect, canChainInMiddle }: OperationListProps) {
  return (
    <ScrollArea className="h-full">
      <div className="py-2" data-testid="operation-list">
        {operations.map((op) => {
          const isDisabled = !canChainInMiddle && OPS_REQUIRING_TABLE_FIRST.includes(op.slug);

          return (
            <TooltipProvider key={op.slug}>
              <div
                className={cn(
                  'flex items-center justify-between px-5 py-3 cursor-pointer transition-colors',
                  isDisabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:bg-teal-50'
                )}
                onClick={() => !isDisabled && onSelect(op)}
                data-testid={`operation-${op.slug}`}
                role="button"
                aria-disabled={isDisabled}
              >
                <span
                  className={cn(
                    'font-medium text-base',
                    isDisabled ? 'text-gray-400' : 'text-gray-700'
                  )}
                >
                  {op.label}
                </span>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      className="p-1 rounded hover:bg-gray-100"
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Info about ${op.label}`}
                    >
                      <Info className="w-4 h-4 text-gray-400" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    className="max-w-xs bg-gray-900 text-white border-gray-700"
                  >
                    <p className="text-sm">
                      {isDisabled ? 'Please create a table to use this function' : op.infoToolTip}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          );
        })}
      </div>
    </ScrollArea>
  );
}
