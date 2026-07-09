'use client';

import { useState, useCallback } from 'react';

// localStorage key for the ingest page's layout mode preference (new/rows/classic).
export const INGEST_UI_MODE_KEY = 'ingest-ui-mode';

export type IngestUiMode = 'new' | 'rows' | 'classic';

// The stacked ("new") mode ships enabled by default; users can switch to side-by-side
// ("rows") or classic tabbed layout, and that choice is remembered per browser.
const DEFAULT_MODE: IngestUiMode = 'new';

function readStoredMode(): IngestUiMode {
  if (typeof window === 'undefined') return DEFAULT_MODE;
  const stored = window.localStorage.getItem(INGEST_UI_MODE_KEY);
  return stored === 'classic' || stored === 'new' || stored === 'rows' ? stored : DEFAULT_MODE;
}

export function useIngestUiMode() {
  const [mode, setModeState] = useState<IngestUiMode>(readStoredMode);

  const setMode = useCallback((next: IngestUiMode) => {
    setModeState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(INGEST_UI_MODE_KEY, next);
    }
  }, []);

  return { mode, setMode };
}
