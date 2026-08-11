import { selectIngestState } from '../state';
import type { Warehouse } from '@/types/warehouse';
import type { Source } from '@/types/source';

describe('selectIngestState', () => {
  it('returns LOADING while warehouse is loading', () => {
    const state = selectIngestState(
      { data: undefined, isLoading: true },
      { data: [], isLoading: false }
    );
    expect(state).toBe('LOADING');
  });

  it('returns LOADING while sources are loading', () => {
    const state = selectIngestState(
      { data: { name: 'wh' } as Warehouse, isLoading: false },
      { data: [], isLoading: true }
    );
    expect(state).toBe('LOADING');
  });

  it('returns NO_WAREHOUSE when no warehouse exists', () => {
    const state = selectIngestState(
      { data: undefined, isLoading: false },
      { data: [], isLoading: false }
    );
    expect(state).toBe('NO_WAREHOUSE');
  });

  it('returns NO_SOURCE when warehouse exists but no sources', () => {
    const state = selectIngestState(
      { data: { name: 'wh' } as Warehouse, isLoading: false },
      { data: [], isLoading: false }
    );
    expect(state).toBe('NO_SOURCE');
  });

  it('returns STEADY when warehouse and at least one source exist', () => {
    const state = selectIngestState(
      { data: { name: 'wh' } as Warehouse, isLoading: false },
      { data: [{ sourceId: 's1' } as Source], isLoading: false }
    );
    expect(state).toBe('STEADY');
  });
});
