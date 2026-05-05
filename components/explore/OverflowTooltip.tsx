// components/explore/OverflowTooltip.tsx
'use client';

import { useRef, useState, useCallback } from 'react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface OverflowTooltipProps {
  text: string;
  className?: string;
  tooltipClassName?: string;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  tooltipAlign?: 'start' | 'center' | 'end';
  onClick?: () => void;
  children?: React.ReactNode;
}

/**
 * Renders truncated text that only shows a tooltip when the content
 * is actually overflowing (i.e. visually truncated).
 */
export function OverflowTooltip({
  text,
  className,
  tooltipClassName = 'max-w-sm break-words whitespace-pre-wrap text-xs',
  tooltipSide = 'bottom',
  tooltipAlign = 'start',
  onClick,
}: OverflowTooltipProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const [showTooltip, setShowTooltip] = useState(false);

  const handleMouseEnter = useCallback(() => {
    const el = textRef.current;
    if (el && el.scrollWidth > el.clientWidth) {
      setShowTooltip(true);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  return (
    <Tooltip open={showTooltip}>
      <TooltipTrigger asChild>
        <span
          ref={textRef}
          className={cn('block truncate', className)}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onClick={onClick}
        >
          {text}
        </span>
      </TooltipTrigger>
      <TooltipContent
        side={tooltipSide}
        align={tooltipAlign}
        className={tooltipClassName}
        onPointerDownOutside={handleMouseLeave}
      >
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
