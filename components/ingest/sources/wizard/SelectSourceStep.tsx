'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useSourceDefinitions } from '@/hooks/api/useSources';
import type { SourceDefinition } from '@/types/source';
import { TOP_SOURCES } from './wizard-state';

export function SelectSourceStep({ onSelect }: { onSelect: (def: SourceDefinition) => void }) {
  const { data: definitions } = useSourceDefinitions();
  const [search, setSearch] = useState('');

  // Match the top-source names to live definitions; drop any the deployment lacks.
  const topCards = useMemo(
    () =>
      TOP_SOURCES.map((t) => ({
        top: t,
        def: definitions.find((d) => d.name.toLowerCase() === t.name.toLowerCase()),
      })).filter((c) => c.def),
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

  return (
    <div className="space-y-6" data-testid="select-source-step">
      <div>
        <h2 className="text-xl font-semibold">Choose a data source</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Select the tool you want to bring data from. Dalgo establishes a secure, read-only
          connection.
        </p>
      </div>

      <Input
        data-testid="source-search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search 200+ sources..."
      />

      {search ? (
        <ul className="divide-y rounded-md border">
          {searchResults.map((def) => (
            <li key={def.sourceDefinitionId}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-muted"
                data-testid={`source-search-result-${def.name}`}
                onClick={() => onSelect(def)}
              >
                <img src={def.icon || '/icons/connection.svg'} alt="" className="h-5 w-5" />
                <span className="text-sm">{def.name}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div>
          <p className="text-xs font-medium uppercase text-muted-foreground">Popular sources</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {topCards.map(({ top, def }) => (
              <button
                key={top.name}
                type="button"
                data-testid={`source-card-${top.name}`}
                onClick={() => onSelect(def!)}
                className="flex items-center gap-3 rounded-lg border p-3 text-left hover:border-primary hover:bg-muted/40"
              >
                <img src={def!.icon || '/icons/connection.svg'} alt="" className="h-8 w-8" />
                <div>
                  <div className="text-sm font-medium">{top.name}</div>
                  <div className="text-xs text-muted-foreground">{top.category}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
