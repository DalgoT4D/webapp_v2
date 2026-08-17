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

  it('returns ERROR — not NO_WAREHOUSE — when the warehouse fetch failed', () => {
    // SWR sits at data:undefined, isLoading:false between error retries. Reading that as
    // NO_WAREHOUSE is what auto-opened the warehouse wizard for orgs that HAVE a warehouse.
    const state = selectIngestState(
      { data: undefined, isLoading: false, isError: new Error('boom') },
      { data: [], isLoading: false }
    );
    expect(state).toBe('ERROR');
  });

  it('returns ERROR when the sources fetch failed', () => {
    // useSources defaults data to [] on error, so without isError an outage reads as NO_SOURCE.
    const state = selectIngestState(
      { data: { name: 'wh' } as Warehouse, isLoading: false },
      { data: [], isLoading: false, isError: new Error('boom') }
    );
    expect(state).toBe('ERROR');
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
