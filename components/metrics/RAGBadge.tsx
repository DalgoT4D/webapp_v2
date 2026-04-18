'use client';

import { cn } from '@/lib/utils';
import type { RAGStatus } from '@/types/metrics';

const STATUS_CONFIG: Record<RAGStatus, { label: string; classes: string }> = {
  green: {
    label: 'On track',
    classes: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  },
  amber: {
    label: 'Needs attention',
    classes: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  red: {
    label: 'Critical',
    classes: 'bg-red-100 text-red-800 border-red-200',
  },
  grey: {
    label: 'No target',
    classes: 'bg-gray-100 text-gray-600 border-gray-200',
  },
};

interface RAGBadgeProps {
  status: RAGStatus;
  achievementPct?: number | null;
  hasTarget?: boolean;
  hasError?: boolean;
  className?: string;
}

export function RAGBadge({
  status,
  achievementPct,
  hasTarget = false,
  hasError = false,
  className,
}: RAGBadgeProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.grey;

  // Determine the correct label for grey status
  let label = config.label;
  if (status === 'grey') {
    if (hasError) {
      label = 'Data unavailable';
    } else if (hasTarget) {
      label = 'Awaiting data';
    }
    // else: "No target" (default)
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium',
        config.classes,
        className
      )}
    >
      <span
        className={cn('h-1.5 w-1.5 rounded-full', {
          'bg-emerald-500': status === 'green',
          'bg-amber-500': status === 'amber',
          'bg-red-500': status === 'red',
          'bg-gray-400': status === 'grey',
        })}
      />
      {label}
      {achievementPct != null && (
        <span className="text-[10px] opacity-70">({achievementPct}%)</span>
      )}
    </span>
  );
}
