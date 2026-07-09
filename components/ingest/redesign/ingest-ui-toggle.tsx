'use client';

import { cn } from '@/lib/utils';
import type { IngestUiMode } from '@/hooks/useIngestUiMode';

interface IngestUiToggleProps {
  mode: IngestUiMode;
  onChange: (mode: IngestUiMode) => void;
}

const OPTIONS: { value: IngestUiMode; label: string }[] = [
  { value: 'new', label: 'Stacked' },
  { value: 'rows', label: 'Side-by-side' },
  { value: 'classic', label: 'Classic' },
];

/**
 * Segmented control to switch the Ingest page between three layouts:
 * stacked ("new"), side-by-side ("rows"), and classic tabbed.
 * Choice is persisted per browser.
 */
export function IngestUiToggle({ mode, onChange }: IngestUiToggleProps) {
  return (
    <div
      className="inline-flex items-center rounded-lg border bg-muted/50 p-0.5"
      role="radiogroup"
      aria-label="Ingest layout"
      data-testid="ingest-ui-toggle"
    >
      {OPTIONS.map((option) => {
        const active = mode === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer',
              active
                ? 'bg-background text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            data-testid={`ingest-ui-toggle-${option.value}`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
