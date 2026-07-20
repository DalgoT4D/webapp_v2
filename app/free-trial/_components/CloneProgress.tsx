'use client';

// Local vertical step list for the /free-trial/progress screen. Kept local to
// the feature folder (not components/ui/) per webapp_v2 rules — this isn't a
// shared/reusable primitive.

import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CloneProgressProps {
  steps: string[];
  currentIndex: number;
  failed: boolean;
}

type StepState = 'done' | 'in-progress' | 'pending';

function stepState(index: number, currentIndex: number, failed: boolean): StepState {
  if (index < currentIndex) return 'done';
  if (index === currentIndex && !failed) return 'in-progress';
  return 'pending';
}

export function CloneProgress({ steps, currentIndex, failed }: CloneProgressProps) {
  return (
    <ol className="space-y-4" data-testid="trial-clone-progress">
      {steps.map((label, index) => {
        const state = stepState(index, currentIndex, failed);

        return (
          <li
            key={label}
            data-testid={`trial-step-${index}`}
            data-state={state}
            className="flex items-center gap-3"
          >
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
                state === 'done' && 'border-primary bg-primary text-white',
                state === 'in-progress' && 'border-primary text-primary',
                state === 'pending' && 'border-muted-foreground/30 text-muted-foreground/30'
              )}
            >
              {state === 'done' && <Check className="h-4 w-4" aria-hidden="true" />}
              {state === 'in-progress' && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {state === 'pending' && <span className="h-2 w-2 rounded-full bg-current" />}
            </span>
            <span
              className={cn(
                'text-sm',
                state === 'done' && 'text-foreground',
                state === 'in-progress' && 'text-primary font-medium',
                state === 'pending' && 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
