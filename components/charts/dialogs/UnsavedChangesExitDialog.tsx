'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Save, LogOut, X } from 'lucide-react';

interface UnsavedChangesExitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
  onLeave: () => void;
  onStay: () => void;
  isSaving?: boolean;
}

export function UnsavedChangesExitDialog({
  open,
  onOpenChange,
  onSave,
  onLeave,
  onStay,
  isSaving = false,
}: UnsavedChangesExitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Unsaved Changes</DialogTitle>
          <DialogDescription>
            You have unsaved changes. What would you like to do?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {/* Save and Leave */}
          <Button
            onClick={onSave}
            disabled={isSaving}
            className="w-full justify-start h-auto p-4 text-left bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
            variant="outline"
          >
            <Save className="w-5 h-5 mr-3 flex-shrink-0 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900 uppercase">
                {isSaving ? 'SAVING...' : 'SAVE AND LEAVE'}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                Save your changes and return to charts
              </div>
            </div>
          </Button>

          {/* Leave without Saving */}
          <Button
            onClick={onLeave}
            disabled={isSaving}
            className="w-full justify-start h-auto p-4 text-left bg-red-50 border border-red-200 text-red-900 hover:bg-red-100"
            variant="outline"
          >
            <LogOut className="w-5 h-5 mr-3 flex-shrink-0 text-red-600" />
            <div>
              <div className="font-medium text-red-900 uppercase">LEAVE WITHOUT SAVING</div>
              <div className="text-sm text-red-700 mt-1">
                Discard your changes and return to charts
              </div>
            </div>
          </Button>

          {/* Stay on Page */}
          <Button
            onClick={onStay}
            disabled={isSaving}
            className="w-full justify-start h-auto p-4 text-left bg-white border border-gray-200 text-gray-900 hover:bg-gray-50"
            variant="outline"
          >
            <X className="w-5 h-5 mr-3 flex-shrink-0 text-gray-600" />
            <div>
              <div className="font-medium text-gray-900 uppercase">STAY ON PAGE</div>
              <div className="text-sm text-gray-500 mt-1">Continue editing this chart</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
