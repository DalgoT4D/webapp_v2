'use client';

import { SaveOptionsDialog } from '@/components/charts/SaveOptionsDialog';
import { UnsavedChangesExitDialog } from '@/components/charts/UnsavedChangesExitDialog';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';

interface EditChartDialogsProps {
  title: string | undefined;
  showSaveDialog: boolean;
  onSaveDialogChange: (open: boolean) => void;
  onSaveExisting: () => void;
  onSaveAsNew: (newTitle: string) => void;
  /** An update or a save-as-new request is in flight. */
  isSaving: boolean;
  /** Only the update request is in flight (the exit dialog's spinner). */
  isMutating: boolean;
  /** From useUnsavedChangesGuard: 'exit' (Cancel) or 'back' (Back button). */
  leaveTarget: string | null;
  onCloseLeavePrompt: () => void;
  onSaveAndLeave: () => void;
  onLeave: () => void;
  onStay: () => void;
  onConfirmBack: () => void;
}

/** Edit page dialogs: save options, Cancel's exit dialog and Back's leave confirmation. */
export function EditChartDialogs({
  title,
  showSaveDialog,
  onSaveDialogChange,
  onSaveExisting,
  onSaveAsNew,
  isSaving,
  isMutating,
  leaveTarget,
  onCloseLeavePrompt,
  onSaveAndLeave,
  onLeave,
  onStay,
  onConfirmBack,
}: EditChartDialogsProps) {
  return (
    <>
      {/* Save Options Dialog */}
      <SaveOptionsDialog
        open={showSaveDialog}
        onOpenChange={onSaveDialogChange}
        originalTitle={title || ''}
        onSaveExisting={onSaveExisting}
        onSaveAsNew={onSaveAsNew}
        isLoading={isSaving}
      />

      {/* Exit Dialog - Save, Leave, or Stay */}
      <UnsavedChangesExitDialog
        open={leaveTarget === 'exit'}
        onOpenChange={(open) => !open && onCloseLeavePrompt()}
        onSave={onSaveAndLeave}
        onLeave={onLeave}
        onStay={onStay}
        isSaving={isMutating}
      />

      {/* Unsaved Changes Dialog (for the Back button) */}
      <ConfirmationDialog
        open={leaveTarget === 'back'}
        onOpenChange={(open) => !open && onCloseLeavePrompt()}
        title="Unsaved Changes"
        description="You have unsaved changes. Are you sure you want to leave without saving?"
        confirmText="Leave Without Saving"
        cancelText="Cancel"
        type="warning"
        testIdPrefix="chart-edit-leave-confirm"
        onConfirm={onConfirmBack}
        onCancel={onCloseLeavePrompt}
      />
    </>
  );
}
