'use client';

import { useEffect, useRef } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import { CONNECTION_HELP, type ConnectionConcept, type ConnectionConceptId } from './constants';

interface ConnectionHelpPanelProps {
  activeConcept: ConnectionConceptId | null;
  onConceptChange: (concept: ConnectionConceptId | null) => void;
  // Source-tailored cards. Defaults to the generic full set when omitted.
  concepts?: ConnectionConcept[];
}

// Right-side documentation panel for the connection form. Explains each sync
// concept in plain language; the card matching `activeConcept` is highlighted
// and scrolled into view as the user focuses the related field.
export function ConnectionHelpPanel({
  activeConcept,
  onConceptChange,
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
        A quick guide to the terms in the table on the left. Click any column heading or field label
        to jump to its explanation.
      </p>
      <Accordion
        type="single"
        collapsible
        value={activeConcept ?? ''}
        onValueChange={(value) => onConceptChange((value as ConnectionConceptId) || null)}
        className="mt-4 overflow-hidden rounded-lg border bg-background"
        data-testid="connection-help-accordion"
      >
        {concepts.map((concept) => {
          const isActive = concept.id === activeConcept;
          return (
            <AccordionItem
              key={concept.id}
              value={concept.id}
              ref={isActive ? activeRef : undefined}
              data-testid={`concept-card-${concept.id}`}
              data-active={isActive}
              className={cn(
                'px-4 transition-colors',
                isActive && 'bg-primary/5 ring-2 ring-inset ring-primary'
              )}
            >
              <AccordionTrigger
                className="py-3.5 text-base font-semibold hover:no-underline"
                data-testid={`concept-trigger-${concept.id}`}
              >
                {concept.title}
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{concept.body}</p>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span className="font-semibold text-foreground">Impact: </span>
                  {concept.impact}
                </p>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </aside>
  );
}
