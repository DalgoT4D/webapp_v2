'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSourceDefinitions } from '@/hooks/api/useSources';
import { useInsightWalkthroughStore } from '@/stores/insightWalkthroughStore';
import {
  PICK_SOURCE_STAGE_FOR,
  SOURCE_NEXT_STAGE_FOR,
} from '@/components/onboarding/insight-walkthrough-constants';
import type { SourceDefinition } from '@/types/source';
import { TOP_SOURCES } from './wizard-state';

interface Props {
  onSelect: (def: SourceDefinition) => void;
  onClose: () => void;
}

export function SelectSourceStep({ onSelect, onClose }: Props) {
  const { data: definitions } = useSourceDefinitions();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selected, setSelected] = useState<SourceDefinition | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Onboarding walkthrough checkpoint (own-data / automate-pipeline forks): this step being
  // on screen is what unlocks the "pick Google Sheets" coachmark, which points at a card in
  // here. Mount is the right signal rather than the New Source click — an org with no
  // warehouse yet never sees that button (the wizard auto-opens on its warehouse step
  // instead), and those are exactly the trial users these forks are for. A no-op when no
  // walkthrough is running, and one-way, so returning here via Back can't rewind anything.
  useEffect(() => {
    const walkthrough = useInsightWalkthroughStore.getState();
    const pickSourceStage = walkthrough.stage ? PICK_SOURCE_STAGE_FOR[walkthrough.stage] : null;
    if (pickSourceStage) walkthrough.advanceIfBefore(pickSourceStage);
  }, []);

  useEffect(() => {
    const closeSearchWhenClickingOutside = (event: PointerEvent) => {
      if (!searchContainerRef.current?.contains(event.target as Node)) {
        setSearchOpen(false);
      }
    };

    document.addEventListener('pointerdown', closeSearchWhenClickingOutside);
    return () => document.removeEventListener('pointerdown', closeSearchWhenClickingOutside);
  }, []);

  // Match the popular-source names to live definitions; drop any the deployment lacks.
  const topCards = useMemo(
    () =>
      TOP_SOURCES.map((t) => {
        const q = t.name.toLowerCase();
        // Prefer an exact name match; only fall back to a substring match so
        // connector names that carry a suffix in the deployment (e.g. "CommCare
        // T4D") still resolve — without an exact-first pass, "Postgres" would
        // greedily grab "AlloyDB for PostgreSQL".
        const def =
          definitions.find((d) => d.name.toLowerCase() === q) ??
          definitions.find((d) => d.name.toLowerCase().includes(q));
        return { top: t, def };
      }).filter((c) => c.def),
    [definitions]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...definitions]
      .filter((d) => !q || d.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [definitions, search]);

  const isSelected = (def: SourceDefinition) =>
    selected?.sourceDefinitionId === def.sourceDefinitionId;

  /**
   * Every selection path (popular card or search result) goes through here so the walkthrough
   * moves its coachmark off the picker and onto Next — whichever source was chosen. The
   * coachmark can't listen for this itself: a search result row doesn't exist in the DOM until
   * the user types, so there's no single element to attach to. advanceIfBefore keeps it
   * one-way, so re-picking a source can't rewind a walkthrough that has moved on.
   */
  const select = (def: SourceDefinition) => {
    setSelected(def);
    setSearchOpen(false);
    const walkthrough = useInsightWalkthroughStore.getState();
    const nextStage = walkthrough.stage ? SOURCE_NEXT_STAGE_FOR[walkthrough.stage] : null;
    if (nextStage) walkthrough.advanceIfBefore(nextStage);
  };

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="select-source-step">
      <div className="h-[340px] overflow-y-auto px-6 py-5" data-testid="source-picker-body">
        <p className="mb-3 text-sm text-muted-foreground">
          Search across 600+ connectors, or choose a popular source below.
        </p>

        <div className="relative z-20" ref={searchContainerRef}>
          <Search
            className="pointer-events-none absolute left-3 top-[22px] -translate-y-1/2 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            data-testid="source-search-input"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSearchOpen(true);
            }}
            // Click and typing open the catalog; FOCUS deliberately does not. The dialog
            // autofocuses its first field, so opening on focus dropped the 600-connector list
            // over the popular-source cards the moment the step mounted — before the user had
            // asked for anything.
            onClick={() => setSearchOpen(true)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setSearchOpen(false);
            }}
            placeholder="Search sources..."
            className="pl-9"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls="source-search-results"
          />

          {searchOpen && (
            <ul
              id="source-search-results"
              role="listbox"
              className="absolute left-0 right-0 top-full mt-2 max-h-56 overflow-y-auto divide-y rounded-md border bg-popover text-popover-foreground shadow-lg"
              data-testid="source-search-results"
            >
              {searchResults.length > 0 ? (
                searchResults.map((def) => (
                  <li key={def.sourceDefinitionId} role="option" aria-selected={isSelected(def)}>
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted focus:bg-muted focus:outline-none',
                        isSelected(def) && 'bg-primary/5'
                      )}
                      data-testid={`source-search-result-${def.name}`}
                      onClick={() => select(def)}
                    >
                      {/* Connector artwork is supplied at runtime by Airbyte, so it cannot
                          use Next Image's static/allow-listed source optimization. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={def.icon || '/icons/connection.svg'}
                        alt=""
                        className="h-6 w-6 flex-shrink-0 object-contain"
                        onError={(e) => {
                          e.currentTarget.src = '/icons/connection.svg';
                        }}
                      />
                      <span className="truncate text-sm">{def.name}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No matching source found
                </li>
              )}
            </ul>
          )}
        </div>

        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Popular quick connects
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {topCards.map(({ top, def }) => (
              <button
                key={top.name}
                type="button"
                data-testid={`source-card-${top.name}`}
                onClick={() => select(def!)}
                className={cn(
                  'flex min-w-0 items-center gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-muted/40',
                  isSelected(def!) && 'border-primary ring-1 ring-primary bg-primary/5'
                )}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-background p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={def!.icon || '/icons/connection.svg'}
                    alt=""
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '/icons/connection.svg';
                    }}
                  />
                </div>
                <span className="min-w-0 truncate text-sm font-semibold">{top.name}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-shrink-0 justify-end gap-2 border-t px-6 py-4">
        {/* No Back: the only step that can precede this one is the warehouse step,
            and reaching here means the warehouse was already created server-side,
            so that step can't be re-entered as a create form. */}
        <Button type="button" variant="outline" onClick={onClose} data-testid="wizard-cancel-btn">
          Cancel
        </Button>
        <Button
          type="button"
          variant="primary"
          className="uppercase"
          disabled={!selected}
          onClick={() => selected && onSelect(selected)}
          data-testid="wizard-select-next-btn"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
