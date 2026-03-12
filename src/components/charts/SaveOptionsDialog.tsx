'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Save, Copy, ArrowLeft } from 'lucide-react';

interface SaveOptionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originalTitle: string;
  onSaveExisting: () => void;
  onSaveAsNew: (newTitle: string) => void;
  isLoading: boolean;
}

export function SaveOptionsDialog({
  open,
  onOpenChange,
  originalTitle,
  onSaveExisting,
  onSaveAsNew,
  isLoading,
}: SaveOptionsDialogProps) {
  const [step, setStep] = useState<'choose' | 'name'>('choose');
  const [newTitle, setNewTitle] = useState(originalTitle);

  // Update default title when original title changes
  useEffect(() => {
    // Use the original title as is for "Save as new" - no "Copy of" prefix
    setNewTitle(originalTitle);
  }, [originalTitle]);

  // Reset to first step when dialog opens
  useEffect(() => {
    if (open) {
      setStep('choose');
    }
  }, [open]);

  const handleSaveExisting = () => {
    onSaveExisting();
    onOpenChange(false);
  };

  const handleSaveAsNewClick = () => {
    setStep('name');
  };

  const handleConfirmSaveAsNew = () => {
    if (newTitle.trim()) {
      onSaveAsNew(newTitle.trim());
      onOpenChange(false);
    }
  };

  const handleBack = () => {
    setStep('choose');
  };

  if (step === 'choose') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Save Chart</DialogTitle>
            <DialogDescription>
              Choose how you want to save your changes to this chart.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {/* Update existing chart */}
            <Button
              onClick={handleSaveExisting}
              disabled={isLoading}
              className="w-full justify-start h-auto p-4 text-left"
              variant="outline"
            >
              <Save className="w-5 h-5 mr-3 flex-shrink-0" />
              <div>
                <div className="font-medium uppercase">UPDATE EXISTING CHART</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Save changes to the current chart
                </div>
              </div>
            </Button>

            {/* Save as new chart */}
            <Button
              onClick={handleSaveAsNewClick}
              disabled={isLoading}
              className="w-full justify-start h-auto p-4 text-left"
              variant="outline"
            >
              <Copy className="w-5 h-5 mr-3 flex-shrink-0" />
              <div>
                <div className="font-medium uppercase">SAVE AS NEW CHART</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Create a new chart with your changes
                </div>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleBack} className="w-5 h-5 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            Save as New Chart
          </DialogTitle>
          <DialogDescription>Enter a name for your new chart.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-title">Chart name</Label>
            <Input
              id="new-title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Enter new chart name"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={isLoading}
            className="font-medium uppercase"
          >
            BACK
          </Button>
          <Button
            onClick={handleConfirmSaveAsNew}
            disabled={isLoading || !newTitle.trim()}
            className="font-medium uppercase"
          >
            {isLoading ? 'CREATING...' : 'CREATE NEW CHART'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
