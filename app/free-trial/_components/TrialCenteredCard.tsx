// Narrow centered card — Figma frames 2452:256 (verify email) and 2453:3070
// (expired token). These two screens are opened from an email link with no form
// context, so the design keeps them minimal rather than split-screen.
//
// TODO: this is the promotion candidate. app/login, app/forgot-password,
// app/invitations, app/welcome and app/resetpassword each hand-roll this same card
// recipe. Extracting it into a shared auth shell is worth doing, but as its own
// change — it touches live auth routes.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

interface TrialCenteredCardProps {
  children: React.ReactNode;
  testId: string;
}

export function TrialCenteredCard({ children, testId }: TrialCenteredCardProps) {
  return (
    <div
      data-testid={testId}
      className="w-full max-w-md space-y-6 rounded-2xl border border-white/20 bg-white/95 p-8 shadow-lg backdrop-blur-sm"
    >
      {children}
    </div>
  );
}
