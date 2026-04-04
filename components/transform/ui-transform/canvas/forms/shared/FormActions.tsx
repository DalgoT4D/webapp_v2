// components/transform/canvas/forms/shared/FormActions.tsx
'use client';

import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormActionsProps {
  /** Whether the form is in view mode (hides save button) */
  isViewMode?: boolean;
  /** Whether the form is submitting */
  isSubmitting?: boolean;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Cancel button handler */
  onCancel?: () => void;
  /** Custom save button text */
  saveText?: string;
  /** Custom cancel button text */
  cancelText?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Standard form action buttons (Save/Cancel) used across operation forms.
 */
export function FormActions({
  isViewMode = false,
  isSubmitting = false,
  disabled = false,
  onCancel,
  saveText = 'Save',
  cancelText = 'Cancel',
  className,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        'flex gap-3 pt-3 pb-3 border-t sticky bottom-0 -mb-6 -mx-6 px-6 bg-white',
        className
      )}
    >
      {onCancel && (
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
          data-testid="form-cancel-btn"
        >
          {cancelText}
        </Button>
      )}
      {!isViewMode && (
        <Button
          type="submit"
          disabled={disabled || isSubmitting}
          className="flex-1 text-white hover:opacity-90"
          style={{ backgroundColor: 'var(--primary)' }}
          data-testid="form-save-btn"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            saveText
          )}
        </Button>
      )}
    </div>
  );
}
