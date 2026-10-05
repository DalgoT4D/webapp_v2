'use client';

import { useCallback, useState, type MutableRefObject } from 'react';
import { apiPut } from '@/lib/api';
import {
  DASHBOARD_RICH_TEXT_FLUSH_EVENT,
  type RichTextFlushEventDetail,
} from '@/components/dashboard/widgets/text/text-element-unified';
import {
  applyRichTextUpdates,
  buildDashboardSavePayload,
  type DashboardEditorState,
  type DashboardSavePayloadOverrides,
  type EditorSetState,
} from '@/components/dashboard/logic/editor-state';
import type { ScreenSizeKey } from '@/components/dashboard/grid/grid-constants';
import type { SaveStatus } from './DashboardBuilderHeader';

/** "Saved" shows this long, then the status returns to idle. */
const SAVED_STATUS_MS = 3000;
/** The error message shows this long. */
const ERROR_STATUS_MS = 5000;

export type { EditorSetState };

interface DashboardSaveOptions {
  dashboardId: number | undefined;
  stateRef: MutableRefObject<DashboardEditorState>;
  setState: EditorSetState;
  title: string;
  description: string;
  targetScreenSize: ScreenSizeKey;
  filterLayout: 'vertical' | 'horizontal';
}

/** Saving the dashboard (PUT) and the status shown next to Save. Rebuilt every render, as before. */
export function useDashboardSave({
  dashboardId,
  stateRef,
  setState,
  title,
  description,
  targetScreenSize,
  filterLayout,
}: DashboardSaveOptions) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  const flushActiveRichText = useCallback((): DashboardEditorState => {
    const detail: RichTextFlushEventDetail = { updates: [] };
    document.dispatchEvent(new CustomEvent(DASHBOARD_RICH_TEXT_FLUSH_EVENT, { detail }));
    if (!detail.updates.length) return stateRef.current;

    const nextState = applyRichTextUpdates(stateRef.current, detail.updates);
    stateRef.current = nextState;
    setState(nextState);
    return nextState;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- same dependency list as before
  }, [setState]);

  // Save dashboard.
  // Resolves to whether the PUT succeeded. Errors are handled here (save status + inline
  // error) rather than thrown, so without a return value a caller cannot tell a failed
  // save from a successful one — and DASHBOARD_UPDATED must never count a failure.
  const saveDashboard = async (
    overrides: DashboardSavePayloadOverrides = {},
    flushRichText = true
  ): Promise<boolean> => {
    if (!dashboardId) return false;

    const editorState = flushRichText ? flushActiveRichText() : stateRef.current;

    setIsSaving(true);
    setSaveStatus('saving');
    setSaveError(null);

    try {
      // Filters are no longer included in dashboard PUT payload - managed via separate endpoints

      const payload = buildDashboardSavePayload({
        title,
        description,
        targetScreenSize,
        filterLayout,
        tabs: editorState.tabs,
        overrides,
      });

      await apiPut(`/api/dashboards/${dashboardId}/`, payload);

      setSaveStatus('saved');
      // Reset save status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, SAVED_STATUS_MS);
      return true;
    } catch (error: unknown) {
      const saveFailure = error as Error;
      console.error('Failed to save dashboard:', saveFailure.message || 'Please try again');
      setSaveStatus('error');
      setSaveError(saveFailure.message || 'Failed to save dashboard. Please try again.');

      // Reset error status after 5 seconds
      setTimeout(() => {
        setSaveStatus('idle');
        setSaveError(null);
      }, ERROR_STATUS_MS);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  return { saveStatus, saveError, isSaving, saveDashboard, flushActiveRichText };
}
