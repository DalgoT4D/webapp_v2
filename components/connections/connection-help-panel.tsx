'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CONNECTION_HELP, type ConnectionConceptId } from './constants';

interface ConnectionHelpPanelProps {
  activeConcept: ConnectionConceptId | null;
}

// Right-side documentation panel for the connection form. Explains each sync
// concept in plain language; the card matching `activeConcept` is highlighted
// and scrolled into view as the user focuses the related field.
export function ConnectionHelpPanel({ activeConcept }: ConnectionHelpPanelProps) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [activeConcept]);

  return (
    <aside
      className="rounded-xl border bg-muted/30 p-6 overflow-y-auto"
      data-testid="connection-help-panel"
    >
      <h3 className="text-base font-semibold">What these options mean</h3>
      <div className="mt-4 space-y-3">
        {CONNECTION_HELP.map((concept) => {
          const isActive = concept.id === activeConcept;
          return (
            <div
              key={concept.id}
              ref={isActive ? activeRef : undefined}
              data-testid={`concept-card-${concept.id}`}
              data-active={isActive}
              className={cn(
                'rounded-lg border bg-background p-4 transition-shadow',
                isActive && 'ring-2 ring-primary'
              )}
            >
              <p className="text-sm font-semibold text-foreground">{concept.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{concept.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">Impact: </span>
                {concept.impact}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
