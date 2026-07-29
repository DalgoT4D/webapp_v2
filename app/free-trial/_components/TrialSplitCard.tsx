// Split-screen shell for the free-trial screens — Figma frames 2452:179 (sign up),
// 2452:416 (waiting), 2453:3089 (failed setup). The password/activate screen (2452:226)
// has no marketing pane, so it uses TrialCenteredCard instead.
//
// Kept local to the feature folder rather than components/ui/, following the same
// reasoning as CloneProgress: the Figma pane widths are baked in, so this is not a
// reusable primitive. Promoting it would mean refactoring the card wrappers that
// app/login, app/forgot-password, app/invitations and app/welcome each copy — a
// separate change to live auth, deliberately not bundled here.
//
// IMPORTANT: no hooks, no state, no context. This wraps the progress screen, whose
// SWR poller resets its refreshInterval if its host re-renders — see the comments in
// app/free-trial/progress/page.tsx. Keeping the shell prop-pure is what stops that
// bug coming back.

interface TrialSplitCardProps {
  /** Left pane — the form/content column. Full width below `lg`. */
  children: React.ReactNode;
  /** Right pane — marketing content. Omit for a form-only card. Hidden below `lg`. */
  aside?: React.ReactNode;
  testId: string;
}

export function TrialSplitCard({ children, aside, testId }: TrialSplitCardProps) {
  return (
    <div
      data-testid={testId}
      // 592px left pane / 1179px card width, corner radius, and drop shadow all
      // mirror the Figma card (frame 2452:181). Tailwind can't read TS constants,
      // so the numbers are inlined here rather than declared elsewhere.
      className="flex w-full max-w-[1179px] overflow-hidden rounded-[20px] bg-white shadow-[0px_20px_60px_0px_rgba(15,23,41,0.12)]"
    >
      <div className="w-full shrink-0 p-8 sm:p-12 lg:w-[592px]">{children}</div>
      {aside ? <div className="hidden lg:block lg:flex-1">{aside}</div> : null}
    </div>
  );
}
