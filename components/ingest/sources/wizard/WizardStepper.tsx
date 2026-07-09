import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WIZARD_STEPS, type WizardStep } from './wizard-state';

export function WizardStepper({ current }: { current: WizardStep }) {
  const currentIndex = WIZARD_STEPS.findIndex((s) => s.id === current);
  return (
    <ol className="flex items-center gap-2" data-testid="wizard-stepper">
      {WIZARD_STEPS.map((step, i) => {
        const active = i === currentIndex;
        const complete = i < currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-2">
            <div
              data-testid={`wizard-step-${step.id}`}
              data-active={active}
              data-complete={complete}
              className={cn(
                'flex items-center gap-2 rounded-full px-3 py-1 text-sm',
                active && 'bg-primary text-primary-foreground font-medium',
                complete && 'text-primary',
                !active && !complete && 'text-muted-foreground'
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border text-xs">
                {complete ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {step.label}
            </div>
            {i < WIZARD_STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
          </li>
        );
      })}
    </ol>
  );
}
