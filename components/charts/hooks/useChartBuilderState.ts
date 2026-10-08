'use client';

import { useCallback, useMemo, useReducer } from 'react';
import type { ChartBuilderFormData } from '@/types/charts';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import type { ChartConfigPatch } from '@/components/charts/logic/type-switch';
import {
  createPageReducer,
  editPageReducer,
  hasUnsavedChanges,
  type ChartBuilderState,
} from '@/components/charts/logic/builder-state';

/**
 * The chart being built and its saved baseline. Create: the first config is the baseline
 * (today an effect copies it after the first render — same value, since auto-prefill needs the
 * columns request to finish first). Edit: no baseline until the chart loads.
 */
export function useChartBuilderState(
  builder: ChartBuilderKind,
  createInitialConfig: () => ChartBuilderFormData
) {
  const [state, dispatch] = useReducer(
    builder === 'create' ? createPageReducer : editPageReducer,
    undefined,
    (): ChartBuilderState => {
      const config = createInitialConfig();
      return { config, savedConfig: builder === 'create' ? { ...config } : null };
    }
  );

  const patchConfig = useCallback(
    (patch: ChartConfigPatch) => dispatch({ type: 'PATCH_CONFIG', patch }),
    []
  );
  const loadSavedChart = useCallback(
    (config: ChartBuilderFormData) => dispatch({ type: 'LOAD_SAVED_CHART', config }),
    []
  );
  const setSavedBaseline = useCallback(
    (config: ChartBuilderFormData) => dispatch({ type: 'SET_SAVED_BASELINE', config }),
    []
  );
  const markSaved = useCallback(() => dispatch({ type: 'MARK_SAVED' }), []);
  const isDirty = useMemo(() => hasUnsavedChanges(state), [state]);

  return {
    config: state.config,
    savedConfig: state.savedConfig,
    hasUnsavedChanges: isDirty,
    patchConfig,
    loadSavedChart,
    setSavedBaseline,
    markSaved,
  };
}
