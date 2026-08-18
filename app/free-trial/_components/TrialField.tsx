// Label + control + error text, matching Figma's "invalid state" frame (2452:3017).
//
// The red border needs no change to components/ui: both Input and SelectTrigger
// already carry `aria-invalid:border-destructive aria-invalid:ring-destructive/20`,
// so the call site only has to pass `aria-invalid` to the control itself.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

import { Label } from '@/components/ui/label';

interface TrialFieldProps {
  /** Must match the `id` on the control passed as children. */
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

export function TrialField({ id, label, error, children }: TrialFieldProps) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs font-medium text-foreground">
        {label}
      </Label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p className="mt-1 text-xs text-destructive" data-testid={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
