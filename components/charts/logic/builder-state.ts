import type { ChartBuilderFormData } from '@/types/charts';
import { deepEqual } from '@/lib/form-utils';
import type { ChartBuilderKind } from '@/components/charts/logic/builder-kind';
import {
  legacyEditPageTypeSwitch,
  type ChartConfigPatch,
} from '@/components/charts/logic/type-switch';

/** The chart being built plus the last saved (or loaded) version, for the unsaved-changes check. */
export interface ChartBuilderState {
  config: ChartBuilderFormData;
  savedConfig: ChartBuilderFormData | null;
}

export type ChartBuilderAction =
  /** Any edit from a panel (field change, auto-prefill, dataset change, chart-type switch patch). */
  | { type: 'PATCH_CONFIG'; patch: ChartConfigPatch }
  /** Edit page: the saved chart arrived — it becomes both the config and the saved baseline. */
  | { type: 'LOAD_SAVED_CHART'; config: ChartBuilderFormData }
  /** Edit page: chart missing and not loading — baseline is the empty config (only if none yet). */
  | { type: 'SET_SAVED_BASELINE'; config: ChartBuilderFormData }
  /** After a save, or right before navigating away on purpose: nothing is unsaved any more. */
  | { type: 'MARK_SAVED' };

/**
 * Merge a patch into the config. BUILDER-DRIFT: the edit page re-derives every patch that changes
 * chart_type from the pre-switch config (legacyEditPageTypeSwitch); the create page just merges.
 */
export function applyConfigPatch(
  config: ChartBuilderFormData,
  patch: ChartConfigPatch,
  builder: ChartBuilderKind
): ChartBuilderFormData {
  return builder === 'edit' ? legacyEditPageTypeSwitch(config, patch) : { ...config, ...patch };
}

function reduce(
  state: ChartBuilderState,
  action: ChartBuilderAction,
  builder: ChartBuilderKind
): ChartBuilderState {
  switch (action.type) {
    case 'PATCH_CONFIG':
      return { ...state, config: applyConfigPatch(state.config, action.patch, builder) };
    case 'LOAD_SAVED_CHART':
      return { config: action.config, savedConfig: action.config };
    case 'SET_SAVED_BASELINE':
      return state.savedConfig ? state : { ...state, savedConfig: { ...action.config } };
    case 'MARK_SAVED':
      return { ...state, savedConfig: { ...state.config } };
    default:
      return state;
  }
}

export const createPageReducer = (state: ChartBuilderState, action: ChartBuilderAction) =>
  reduce(state, action, 'create');

export const editPageReducer = (state: ChartBuilderState, action: ChartBuilderAction) =>
  reduce(state, action, 'edit');

/** PINNED-BUGS: "Back asks 'unsaved changes?' with no user edits" — auto-prefill counts as a change. */
export function hasUnsavedChanges(state: ChartBuilderState): boolean {
  return state.savedConfig ? !deepEqual(state.config, state.savedConfig) : false;
}
