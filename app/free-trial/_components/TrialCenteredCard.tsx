// Centered card — Figma frames 2452:256 (verify email) and 2453:3070
// (expired token). These two screens are opened from an email link with no form
// context, so the design keeps them minimal rather than split-screen.
//
// TODO: this is the promotion candidate. app/login, app/forgot-password,
// app/invitations, app/welcome and app/resetpassword each hand-roll this same card
// recipe. Extracting it into a shared auth shell is worth doing, but as its own
// change — it touches live auth routes.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

import { cn } from '@/lib/utils';

/**
 * `default` fits the short single-message screens (verify email, expired token, signup
 * confirmation). `wide` is for screens carrying several stacked blocks of body copy — at the
 * default width those wrap after a handful of words and the card reads as a narrow column.
 */
const CARD_WIDTHS = {
  default: 'max-w-md',
  wide: 'max-w-2xl',
} as const;

interface TrialCenteredCardProps {
  children: React.ReactNode;
  testId: string;
  width?: keyof typeof CARD_WIDTHS;
}

export function TrialCenteredCard({ children, testId, width = 'default' }: TrialCenteredCardProps) {
  return (
    <div
      data-testid={testId}
      className={cn(
        'w-full space-y-6 rounded-2xl border border-white/20 bg-white/95 p-8 shadow-lg backdrop-blur-sm',
        CARD_WIDTHS[width]
      )}
    >
      {children}
    </div>
  );
}
