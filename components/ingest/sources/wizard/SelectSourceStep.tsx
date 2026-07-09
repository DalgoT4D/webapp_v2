'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useSourceDefinitions } from '@/hooks/api/useSources';
import type { SourceDefinition } from '@/types/source';
import { TOP_SOURCES, MAX_TOP_CARDS } from './wizard-state';

interface Props {
  onSelect: (def: SourceDefinition) => void;
  onClose: () => void;
}

export function SelectSourceStep({ onSelect, onClose }: Props) {
  const { data: definitions } = useSourceDefinitions();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SourceDefinition | null>(null);

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
      })
        .filter((c) => c.def)
        .slice(0, MAX_TOP_CARDS),
    [definitions]
  );

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return [...definitions]
      .filter((d) => d.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20);
  }, [definitions, search]);

  const isSelected = (def: SourceDefinition) =>
    selected?.sourceDefinitionId === def.sourceDefinitionId;

  return (
    <div className="flex flex-1 min-h-0 flex-col" data-testid="select-source-step">
      {/* Fixed-height body so the modal doesn't grow/shrink with the number of
          search results — the popular grid and the results list scroll inside. */}
      <div className="h-[420px] overflow-y-auto px-6 py-5 space-y-5">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            data-testid="source-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search 200+ sources..."
            className="pl-9"
          />
        </div>

        {search ? (
          <ul className="divide-y rounded-md border">
            {searchResults.map((def) => (
              <li key={def.sourceDefinitionId}>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted',
                    isSelected(def) && 'bg-primary/5'
                  )}
                  data-testid={`source-search-result-${def.name}`}
                  onClick={() => setSelected(def)}
                >
                  <img
                    src={def.icon || '/icons/connection.svg'}
                    alt=""
                    className="h-5 w-5"
                    onError={(e) => {
                      e.currentTarget.src = '/icons/connection.svg';
                    }}
                  />
                  <span className="text-sm">{def.name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Popular sources
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {topCards.map(({ top, def }) => (
                <button
                  key={top.name}
                  type="button"
                  data-testid={`source-card-${top.name}`}
                  onClick={() => setSelected(def!)}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-4 text-left transition-colors hover:border-primary hover:bg-muted/40',
                    isSelected(def!) && 'border-primary ring-1 ring-primary bg-primary/5'
                  )}
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border bg-white">
                    <img
                      src={def!.icon || '/icons/connection.svg'}
                      alt=""
                      className="h-6 w-6"
                      onError={(e) => {
                        e.currentTarget.src = '/icons/connection.svg';
                      }}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{top.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{top.category}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 justify-end gap-2 border-t px-6 py-4">
        <Button type="button" variant="outline" onClick={onClose} data-testid="wizard-back-btn">
          Back
        </Button>
        <Button
          type="button"
          variant="primary"
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
