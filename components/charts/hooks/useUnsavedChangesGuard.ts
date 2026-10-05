'use client';

import { useCallback, useEffect, useState } from 'react';

const LEAVE_WARNING = 'You have unsaved changes. Are you sure you want to leave?';

/**
 * Browser-level leave warning plus the state of the page's own "leave?" dialog(s).
 * PINNED-BUGS: auto-prefill counts as a change, so a fresh create page already warns.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = LEAVE_WARNING;
        return LEAVE_WARNING;
      }
      return undefined;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  /** Where the user wants to go while a leave dialog is open ('back', a URL, or a dialog name). */
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  const askToLeave = useCallback((target: string) => setLeaveTarget(target), []);
  const closeLeavePrompt = useCallback(() => setLeaveTarget(null), []);

  return { leaveTarget, askToLeave, closeLeavePrompt };
}
