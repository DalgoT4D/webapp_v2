import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { FormMode } from '@/constants/connections';
import { ConnectionFormBody } from '@/components/connections/connection-form-body';
import type { SourceDefinition } from '@/types/source';
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

  // Step-aware modal header. The configure step names the chosen source; the
  // helper panel on the right of that step walks the user through each field.
  const header = {
    select: {
      title: 'Choose your source',
      description:
        'Select the tool you want to bring data from. We’ve securely connected a sample warehouse to your trial so you can see things working instantly.',
    },
    configure: {
      title: `Configure ${def?.name ?? 'source'}`,
      description:
        'Fill in the details on the left. The panel on the right walks you through exactly where to find each one.',
    },
    connection: {
      title: 'Set up a connection',
      description: 'Choose what to sync from this source into your warehouse.',
    },
  }[step];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden',
          // The picker is a compact, near-square card grid; the configure and
          // connection steps need more room for the form + helper / streams table.
          step === 'select' ? 'sm:max-w-2xl' : 'sm:max-w-[1240px] min-h-[640px]'
        )}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 space-y-1 border-b px-6 pt-6 pb-4 text-left">
          <DialogTitle className="text-2xl font-bold">{header.title}</DialogTitle>
          <DialogDescription>{header.description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-1 min-h-0 flex-col">
          {step === 'select' && (
            <SelectSourceStep
              onClose={onClose}
              onSelect={(d) => {
                setDef(d);
                setStep('configure');
              }}
            />
          )}

          {step === 'configure' && def && (
            <CreateSourceStep
              key={def.sourceDefinitionId}
              def={def}
              onBack={() => setStep('select')}
              onCreated={(sourceId) => {
                setCreatedSourceId(sourceId);
                setStep('connection');
              }}
            />
          )}

          {/* ConnectionFormBody is a fragment that owns its own scrollable body
              + pinned footer, so it renders directly as a flex-col child here —
              no wrapper, which would break its internal flex-1/min-h-0 layout. */}
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
