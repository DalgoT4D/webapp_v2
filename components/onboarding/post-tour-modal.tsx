'use client';

/**
 * "What would you like to try first?" — shown once the guided product tour finishes via its
 * last step's "Finish Tour" button (not on Skip; see tour-gate.tsx's onTourEnd handling). Both
 * options route straight into the follow-up flow since the tour itself already covered "what
 * is this feature" for both.
 */
import { BarChart3, ChevronRight, Workflow } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface PostTourModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires instead of navigating when the user picks "Build your first insight". */
  onSelectInsight: () => void;
}

interface PostTourOption {
  id: 'insight' | 'pipeline';
  icon: typeof BarChart3;
  label: string;
  description: string;
  href: string;
}

const POST_TOUR_OPTIONS: PostTourOption[] = [
  {
    id: 'insight',
    icon: BarChart3,
    label: 'Build your first insight',
    description: 'Turn the data into a chart and dashboard you can share',
    href: '/charts',
  },
  {
    id: 'pipeline',
    icon: Workflow,
    label: 'Automate Pipeline',
    description: 'Transform your table and schedule them',
    href: '/transform',
  },
];

export function PostTourModal({ open, onOpenChange, onSelectInsight }: PostTourModalProps) {
  const router = useRouter();

  const handleSelect = (option: PostTourOption) => {
    trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_DISMISSED, { choice: option.id });
    onOpenChange(false);
    if (option.id === 'insight') {
      onSelectInsight();
      return;
    }
    router.push(option.href);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_DISMISSED, { choice: 'close' });
        } else {
          trackEvent(ANALYTICS_EVENTS.POST_TOUR_MODAL_VIEWED);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent data-testid="post-tour-modal" className="sm:max-w-2xl">
        <DialogTitle className="text-2xl font-bold text-foreground">
          You’ve explored Dalgo, what would you like to try first?
        </DialogTitle>
        <p className="text-sm text-muted-foreground">
          Your workspace comes with sample data, so you can see results straight away.
        </p>
        <div className="mt-2 divide-y">
          {POST_TOUR_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              data-testid={`post-tour-option-${option.id}`}
              onClick={() => handleSelect(option)}
              className="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-muted/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <option.icon className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-foreground">{option.label}</span>
                <span className="block text-xs text-muted-foreground">{option.description}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
