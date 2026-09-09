// A titled message card with a stack of actions. One component covers five screens:
// expired token (Figma 2453:3070), account-exists conflict, workspace-ready manual
// login, poll timeout, and missing setup task.
//
// Actions are children rather than a config prop, so a caller can pass a link
// (`<Button asChild><Link/></Button>`) or an in-place handler without this component
// knowing about either.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

import { TrialBrandHeader } from './TrialBrandHeader';
import { TrialCenteredCard } from './TrialCenteredCard';

interface TrialNoticeCardProps {
  testId: string;
  title: string;
  description: React.ReactNode;
  /** Buttons/links, stacked under the description. */
  children?: React.ReactNode;
}

export function TrialNoticeCard({ testId, title, description, children }: TrialNoticeCardProps) {
  return (
    <TrialCenteredCard testId={testId}>
      <TrialBrandHeader title={title} subtitle={description} align="center" />
      {children ? <div className="space-y-3">{children}</div> : null}
    </TrialCenteredCard>
  );
}
