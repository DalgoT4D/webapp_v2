import { useCallback, useEffect, useState } from 'react';
import { toastSuccess, toastError } from '@/lib/toast';
import { updateSnapshot } from '@/hooks/api/useReports';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface UseSummaryEditorArgs {
  /** The report id. (Named like the page variable so the analytics line stays identical.) */
  parsedId: number;
  /** The saved summary (`report_metadata.summary`); undefined until the report loads. */
  savedSummary: string | undefined;
  /** Revalidates the report view after a save. */
  mutate: () => Promise<unknown>;
}

/** Executive-summary editing on the report viewer: draft, edit mode, Save / Cancel. */
export function useSummaryEditor({ parsedId, savedSummary, mutate }: UseSummaryEditorArgs) {
  const [summaryDraft, setSummaryDraft] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [summaryTouched, setSummaryTouched] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);

  // Sync summary draft when viewData loads or revalidates (only if user isn't editing)
  useEffect(() => {
    if (!summaryTouched) {
      setSummaryDraft(savedSummary ?? '');
    }
  }, [savedSummary, summaryTouched]);

  const handleSave = useCallback(async () => {
    const currentSummary = (savedSummary ?? '').trim();
    if (summaryDraft.trim() === currentSummary) {
      setSummaryTouched(false);
      setIsEditingSummary(false);
      return;
    }
    setIsSaving(true);
    try {
      await updateSnapshot(parsedId, { summary: summaryDraft });
      // The summary is the only mutable part of a frozen snapshot. The no-op early return
      // above means this fires on a real text change, not on opening and closing the editor.
      trackEvent(ANALYTICS_EVENTS.REPORT_SUMMARY_UPDATED, { report_id: parsedId });
      await mutate();
      setSummaryTouched(false);
      setIsEditingSummary(false);
      toastSuccess.saved('Report');
    } catch (error) {
      toastError.save(error, 'report');
    } finally {
      setIsSaving(false);
    }
  }, [parsedId, summaryDraft, mutate, savedSummary]);

  const handleDraftChange = useCallback((value: string) => {
    setSummaryDraft(value);
    setSummaryTouched(true);
  }, []);

  const handleStartEditing = useCallback(() => {
    setIsEditingSummary(true);
    requestAnimationFrame(() => {
      const textarea = document.querySelector(
        '[data-testid="report-summary-textarea"]'
      ) as HTMLTextAreaElement;
      textarea?.focus();
    });
  }, []);

  const handleCancel = useCallback(() => {
    setSummaryDraft(savedSummary || '');
    setSummaryTouched(false);
    setIsEditingSummary(false);
  }, [savedSummary]);

  return {
    summaryDraft,
    isSaving,
    isEditingSummary,
    handleDraftChange,
    handleStartEditing,
    handleCancel,
    handleSave,
  };
}

export type SummaryEditorState = ReturnType<typeof useSummaryEditor>;
