'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TooltipLabelProps {
  /**
   * The rendered (possibly highlighted/decorated) label content — what's actually shown,
   * truncated with an ellipsis if it overflows.
   */
  children: React.ReactNode;
  /**
   * The full, plain-text label to show in the tooltip on hover.
   */
  label: string;
  /**
   * Extra classes for the truncated span (e.g. width constraints like 'max-w-[120px]').
   */
  className?: string;
  /**
   * Tooltip position relative to the label. Defaults to 'right', which fits best for
   * items inside a combobox dropdown list (opens away from the list itself).
   */
  side?: 'top' | 'bottom' | 'left' | 'right';
}

/**
 * Truncated text + hover tooltip showing the full label. Used inside Combobox `renderItem`
 * callbacks for chart dropdowns whose options come from the warehouse (column names, dataset
 * names, etc.) and can be arbitrarily long.
 *
 * z-[60] keeps the tooltip above the combobox's own popover panel — both default to z-50, and
 * the popover mounts first, so without this override the tooltip can render visually behind it.
 */
export function TooltipLabel({ children, label, className, side = 'right' }: TooltipLabelProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* block, not the span default of inline, so text-overflow ellipsis actually applies */}
        <span className={cn('block truncate', className)}>{children}</span>
      </TooltipTrigger>
      <TooltipContent side={side} className="z-[60]">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
