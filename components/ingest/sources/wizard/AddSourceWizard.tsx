import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { FormMode } from '@/constants/connections';
import { ConnectionFormBody } from '@/components/connections/connection-form-body';
import type { SourceDefinition } from '@/types/source';
import { WizardStepper } from './WizardStepper';
import { SelectSourceStep } from './SelectSourceStep';
import { CreateSourceStep } from './CreateSourceStep';
import type { WizardStep } from './wizard-state';

interface Props {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function AddSourceWizard({ open, onClose, onComplete }: Props) {
  const [step, setStep] = useState<WizardStep>('select');
  const [def, setDef] = useState<SourceDefinition | null>(null);
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);

  // Reset whenever the dialog is (re)opened, so a prior run doesn't leak in.
  useEffect(() => {
    if (open) {
      setStep('select');
      setDef(null);
      setCreatedSourceId(null);
    }
  }, [open]);

  // Dismissing the wizard (top-right X, Esc — i.e. Radix onOpenChange→false).
  // If a source was already created (step 3 reached), the source now exists
  // server-side, so we must refresh the list — call onComplete (which also
  // closes) rather than a bare onClose that would leave the list stale (spec
  // §5.3: the source should appear as a 0-connection row). If no source was
  // created yet, just close.
  const handleDismiss = () => {
    if (createdSourceId) {
      onComplete();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto" preventOutsideClose>
        <DialogHeader className="space-y-4">
          <DialogTitle>Add source</DialogTitle>
          <DialogDescription>
            Add a new data source and connect it to your warehouse.
          </DialogDescription>
          <WizardStepper current={step} />
        </DialogHeader>

        {step === 'select' && (
          <SelectSourceStep
            onSelect={(d) => {
              setDef(d);
              setStep('configure');
            }}
          />
        )}

        {step === 'configure' && def && (
          <CreateSourceStep
            def={def}
            onBack={() => setStep('select')}
            onCreated={(sourceId) => {
              setCreatedSourceId(sourceId);
              setStep('connection');
            }}
          />
        )}

        {step === 'connection' && createdSourceId && (
          <ConnectionFormBody
            mode={FormMode.CREATE}
            presetSourceId={createdSourceId}
            onCancel={() => {
              // Source is already created — closing here just keeps it with
              // 0 connections and lets the list refresh to show it.
              onComplete();
              onClose();
            }}
            onSuccess={() => {
              onComplete();
              onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
