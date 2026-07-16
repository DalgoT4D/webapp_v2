import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
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
  // Connection step starts compact (just name + "Fetching…") and widens only
  // once the streams table appears — driven by ConnectionFormBody.
  const [connectionExpanded, setConnectionExpanded] = useState(false);
  // Custom sources (Sheets/Kobo) put their success + "select your sheets/forms"
  // copy in the header; null for generic sources (keep the neutral header).
  const [connectionHeaderInfo, setConnectionHeaderInfo] = useState<{
    sourceName: string;
    streamNoun: string;
  } | null>(null);

  // Reset whenever the dialog is (re)opened, so a prior run doesn't leak in.
  useEffect(() => {
    if (open) {
      setStep('select');
      setDef(null);
      setCreatedSourceId(null);
      setConnectionExpanded(false);
      setConnectionHeaderInfo(null);
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

  // Wizard progress: the header shows a 3-segment bar + "Step N of 3 · label"
  // so the modal reads as a stepper rather than three unrelated dialogs.
  const STEP_ORDER: WizardStep[] = ['select', 'configure', 'connection'];
  const STEP_LABELS: Record<WizardStep, string> = {
    select: 'Choose source',
    configure: 'Configure',
    connection: 'Select data',
  };
  const stepIndex = STEP_ORDER.indexOf(step);

  // Step-aware modal header. The configure step names the chosen source; the
  // helper panel on the right of that step walks the user through each field.
  const header = {
    select: {
      title: 'Choose your data source',
      description:
        'Pick the tool you want to bring data from — Dalgo connects to 500+ sources. Start with a popular one below, or search the full catalog.',
    },
    configure: {
      title: `Configure ${def?.name ?? 'source'}`,
      description:
        'Fill in the details on the left. The panel on the right walks you through exactly where to find each one.',
    },
    connection: connectionHeaderInfo
      ? {
          title: `${connectionHeaderInfo.sourceName} created successfully`,
          // Standard success state: teal check icon (brand --primary) beside a
          // default-colour title — plain green title text read as odd.
          success: true,
          description: `Now select the ${connectionHeaderInfo.streamNoun.toLowerCase()} you want to sync into your warehouse.`,
        }
      : {
          title: 'Set up a connection',
          description: 'Choose what to sync from this source into your warehouse.',
        },
  }[step];

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent
        className={cn(
          'max-h-[90vh] p-0 gap-0 flex flex-col overflow-hidden',
          // The picker is a compact, near-square card grid; the configure step
          // needs room for the form + helper; the connection step is widest to
          // fit the streams table alongside the help panel.
          'transition-[max-width,width] duration-300 ease-out',
          step === 'select'
            ? 'sm:max-w-xl'
            : step === 'connection'
              ? connectionExpanded
                ? '!max-w-[1600px] !w-[96vw] max-h-[85vh]'
                : '!max-w-[720px] !w-[92vw] max-h-[85vh]'
              : 'sm:max-w-[1240px] min-h-[640px]'
        )}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 space-y-2 border-b px-6 pt-6 pb-4 text-left">
          {/* Stepper eyebrow: segmented progress + "Step N of 3 · label". */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5" aria-hidden="true">
              {STEP_ORDER.map((s, i) => (
                <span
                  key={s}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i < stepIndex
                      ? 'w-6 bg-primary'
                      : i === stepIndex
                        ? 'w-8 bg-primary'
                        : 'w-4 bg-muted-foreground/25'
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Step {stepIndex + 1} of {STEP_ORDER.length} · {STEP_LABELS[step]}
            </span>
          </div>
          <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
            {header.success && (
              <CheckCircle2 className="h-6 w-6 flex-shrink-0 text-primary" aria-hidden="true" />
            )}
            {header.title}
          </DialogTitle>
          <DialogDescription className="text-base">{header.description}</DialogDescription>
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
              onExpandedChange={setConnectionExpanded}
              onHeaderInfoChange={setConnectionHeaderInfo}
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
