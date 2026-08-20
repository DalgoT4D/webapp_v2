import { useEffect, useRef, useState } from 'react';
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
import { WarehouseFormBody } from '@/components/ingest/warehouse/warehouse-form-body';
import type { SourceDefinition } from '@/types/source';
import { SelectSourceStep } from './SelectSourceStep';
import { CreateSourceStep } from './CreateSourceStep';
import type { WizardStep } from './wizard-state';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface Props {
  open: boolean;
  onClose: () => void;
  /**
   * The run finished and the list needs refreshing. `connectionCreated` tells the host
   * whether a connection now exists server-side — it decides whether a source showing
   * zero connections is genuinely empty or just waiting on the refetch.
   */
  onComplete: (result: { connectionCreated: boolean }) => void;
  /** No warehouse yet: prepend a warehouse step so the flow is 4 steps (warehouse
   *  → select → configure → connection) instead of the usual 3. Read only when the
   *  dialog opens — see hasWarehouseStep. */
  needsWarehouse?: boolean;
  /** Live "the org has a warehouse" signal. If it flips true while we're still on the
   *  warehouse step, that step was opened on a stale/failed read of the warehouse, so we
   *  drop it rather than ask for a warehouse that already exists. */
  warehouseExists?: boolean;
}

export function AddSourceWizard({
  open,
  onClose,
  onComplete,
  needsWarehouse = false,
  warehouseExists = false,
}: Props) {
  const [step, setStep] = useState<WizardStep>(needsWarehouse ? 'warehouse' : 'select');
  // Whether THIS run of the wizard includes the warehouse step, captured when the dialog
  // opens. Held separately from the prop so a mid-flow change to `needsWarehouse` can't
  // re-enter the warehouse step and wipe the source the user already configured.
  const [hasWarehouseStep, setHasWarehouseStep] = useState(needsWarehouse);
  const needsWarehouseRef = useRef(needsWarehouse);
  needsWarehouseRef.current = needsWarehouse;
  // Step funnel for the Add Source wizard, so the step people abandon on is visible
  // (same shape as the KPI and alert wizards). has_warehouse_step matters because a first
  // source in a fresh org carries an extra warehouse step ahead of everything else.
  useEffect(() => {
    if (open) {
      trackEvent(ANALYTICS_EVENTS.SOURCE_WIZARD_STEP_VIEWED, {
        step,
        has_warehouse_step: hasWarehouseStep,
      });
    }
  }, [open, step, hasWarehouseStep]);

  const [def, setDef] = useState<SourceDefinition | null>(null);
  const [createdSourceId, setCreatedSourceId] = useState<string | null>(null);
  // Connection step starts compact (just name + "Fetching…") and widens only
  // once the streams table appears — driven by ConnectionFormBody.
  const [connectionExpanded, setConnectionExpanded] = useState(false);
  // Once the source resolves, its name drives the connection-step heading
  // ("<source> created successfully") for every source, and `streamNoun`
  // ("tables") tunes the helper line. Null until the source resolves.
  const [connectionHeaderInfo, setConnectionHeaderInfo] = useState<{
    sourceName: string;
    streamNoun?: string;
  } | null>(null);

  // Reset whenever the dialog is (re)opened, so a prior run doesn't leak in. Keyed on `open`
  // ALONE — `needsWarehouse` is read through a ref here. With it in the dependency array, a
  // change to the prop while the dialog was open re-ran this and threw the user back to step 1
  // mid-flow, discarding the source they had already configured.
  useEffect(() => {
    if (open) {
      setHasWarehouseStep(needsWarehouseRef.current);
      setStep(needsWarehouseRef.current ? 'warehouse' : 'select');
      setDef(null);
      setCreatedSourceId(null);
      setConnectionExpanded(false);
      setConnectionHeaderInfo(null);
    }
  }, [open]);

  // Self-heal a warehouse step that shouldn't be here: the org turns out to have a warehouse
  // (a failed fetch finally succeeded on retry) while we're still showing the warehouse form.
  // Drop the step and its slot in the stepper, and move on to picking a source. Only fires on
  // the warehouse step, so a warehouse the user creates here (where the host deliberately does
  // not revalidate until close) can't renumber the flow underneath them.
  useEffect(() => {
    if (open && warehouseExists && step === 'warehouse') {
      setHasWarehouseStep(false);
      setStep('select');
    }
  }, [open, warehouseExists, step]);

  // Dismissing the wizard (top-right X, Esc — i.e. Radix onOpenChange→false).
  // If a source was already created (step 3 reached), the source now exists
  // server-side, so we must refresh the list — call onComplete (which also
  // closes) rather than a bare onClose that would leave the list stale (spec
  // §5.3: the source should appear as a 0-connection row). If no source was
  // created yet, just close.
  const handleDismiss = () => {
    if (createdSourceId) {
      onComplete({ connectionCreated: false });
    } else {
      onClose();
    }
  };

  // Wizard progress: the header shows a segmented bar + "Step N of M · label" so
  // the modal reads as a stepper. The warehouse step is prepended only when the org
  // has no warehouse yet (4 steps); otherwise it's the usual 3.
  const STEP_ORDER: WizardStep[] = hasWarehouseStep
    ? ['warehouse', 'select', 'configure', 'connection']
    : ['select', 'configure', 'connection'];
  const STEP_LABELS: Record<WizardStep, string> = {
    warehouse: 'Set up warehouse',
    select: 'Choose source',
    configure: 'Configure',
    connection: 'Select data',
  };
  const stepIndex = STEP_ORDER.indexOf(step);

  // Step-aware modal header. The configure step names the chosen source.
  const header = {
    warehouse: {
      title: 'Set up your warehouse',
      description: 'A warehouse is where all your data lands — set it up once, then add sources.',
    },
    select: {
      title: 'Choose your data source',
      description: 'Pick a popular source below, or search the full catalog.',
    },
    configure: {
      title: `Configure ${def?.name ?? 'source'}`,
      description: 'Fill in the details below to connect your source.',
    },
    connection: connectionHeaderInfo
      ? {
          title: `${connectionHeaderInfo.sourceName} created successfully`,
          // Standard success state: teal check icon (brand --primary) beside a
          // default-colour title — plain green title text read as odd.
          success: true,
          description: connectionHeaderInfo.streamNoun
            ? `Now select the ${connectionHeaderInfo.streamNoun.toLowerCase()} you want to sync into your warehouse.`
            : 'Choose what to sync from this source into your warehouse.',
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
          // holds a single-column form; the connection step is widest to fit the
          // streams table alongside the help panel.
          'transition-[max-width,width] duration-300 ease-out',
          step === 'select'
            ? 'sm:max-w-xl'
            : step === 'connection'
              ? connectionExpanded
                ? '!max-w-[1600px] !w-[96vw] max-h-[85vh]'
                : '!max-w-[720px] !w-[92vw] max-h-[85vh]'
              : // warehouse + configure: single-column form
                'sm:max-w-3xl min-h-[640px]'
        )}
        preventOutsideClose
      >
        <DialogHeader className="flex-shrink-0 space-y-2 border-b px-6 pt-6 pb-4 text-left">
          {/* Stepper eyebrow: segmented progress + "Step N of M · label". */}
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
          {step === 'warehouse' && (
            <WarehouseFormBody
              submitLabel="Save & Continue"
              onCancel={handleDismiss}
              onSuccess={() => {
                // Warehouse now exists server-side. Advance to the source picker.
                // The host deliberately does NOT revalidate the warehouse until the
                // wizard closes — flipping the ingest state mid-flow would swap the
                // card behind this open dialog and disrupt it.
                setStep('select');
              }}
            />
          )}

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
                onComplete({ connectionCreated: false });
                onClose();
              }}
              onSuccess={() => {
                onComplete({ connectionCreated: true });
                onClose();
              }}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
