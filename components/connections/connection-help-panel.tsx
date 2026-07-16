'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { CONNECTION_HELP, type ConnectionConcept, type ConnectionConceptId } from './constants';

interface ConnectionHelpPanelProps {
  activeConcept: ConnectionConceptId | null;
  // Source-tailored cards. Defaults to the generic full set when omitted.
  concepts?: ConnectionConcept[];
}

// Right-side documentation panel for the connection form. Explains each sync
// concept in plain language; the card matching `activeConcept` is highlighted
// and scrolled into view as the user focuses the related field.
export function ConnectionHelpPanel({
  activeConcept,
  concepts = CONNECTION_HELP,
}: ConnectionHelpPanelProps) {
  const activeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
  }, [activeConcept]);

  return (
    <aside
      className="h-full overflow-y-auto rounded-xl border bg-muted/30 p-6"
      data-testid="connection-help-panel"
    >
      <h3 className="text-lg font-semibold">What these options mean</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        A quick guide to the choices on the left. Click any underlined label to jump here.
      </p>
      <div className="mt-4 space-y-3">
        {concepts.map((concept) => {
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
              <p className="text-base font-semibold text-foreground">{concept.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{concept.body}</p>
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">Impact: </span>
                {concept.impact}
              </p>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
