import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UnsavedChangesDialogState {
  open: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Hook to detect and warn about unsaved changes with custom dialog
 */
export function useUnsavedChanges(
  hasUnsavedChanges: boolean,
  message: string = 'You have unsaved changes. Are you sure you want to leave without saving?'
) {
  const router = useRouter();
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const [dialogState, setDialogState] = useState<UnsavedChangesDialogState>({
    open: false,
    onConfirm: () => {},
    onCancel: () => {},
  });

  // Keep ref updated
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  // Handle browser navigation (refresh, close tab, external links)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChangesRef.current) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
      return undefined;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [message]);

  // Show custom confirmation dialog
  const showConfirmDialog = useCallback((onConfirm: () => void, onCancel?: () => void) => {
    setDialogState({
      open: true,
      onConfirm: () => {
        setDialogState((prev) => ({ ...prev, open: false }));
        onConfirm();
      },
      onCancel: () => {
        setDialogState((prev) => ({ ...prev, open: false }));
        if (onCancel) onCancel();
      },
    });
  }, []);

  // Helper function for confirming navigation
  const confirmNavigation = useCallback(
    (callback: () => void) => {
      if (hasUnsavedChangesRef.current) {
        showConfirmDialog(callback);
      } else {
        callback();
      }
    },
    [showConfirmDialog]
  );

  // Helper function to bypass warning for programmatic navigation
  const navigateWithoutWarning = useCallback(
    (url: string) => {
      hasUnsavedChangesRef.current = false;
      router.push(url);
    },
    [router]
  );

  // Helper to trigger navigation with confirmation
  const confirmAndNavigate = useCallback(
    (url: string) => {
      confirmNavigation(() => {
        hasUnsavedChangesRef.current = false;
        router.push(url);
      });
    },
    [router, confirmNavigation]
  );

  // Helper to go back with confirmation
  const confirmAndGoBack = useCallback(() => {
    confirmNavigation(() => {
      hasUnsavedChangesRef.current = false;
      router.back();
    });
  }, [router, confirmNavigation]);

  return {
    navigateWithoutWarning,
    confirmAndNavigate,
    confirmAndGoBack,
    dialogState,
    message,
  };
}
