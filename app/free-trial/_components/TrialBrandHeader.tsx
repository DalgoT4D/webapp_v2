// Logo + title + optional subtitle. Replaces the block that was copy-pasted into
// every card across the three free-trial pages.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

import Image from 'next/image';
import { cn } from '@/lib/utils';

interface TrialBrandHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  /** Left for the split card's form pane, center for the standalone cards. */
  align?: 'left' | 'center';
  /** Lands on the heading itself, for screens whose tests key off it. */
  testId?: string;
  /** Gap below the logo. Defaults to the 32px used by every screen except the
   *  signup card, whose Figma frame (2452:184) spaces it 62px instead. */
  logoGapClassName?: string;
}

export function TrialBrandHeader({
  title,
  subtitle,
  align = 'left',
  testId,
  logoGapClassName = 'mb-8',
}: TrialBrandHeaderProps) {
  const centered = align === 'center';

  return (
    <div className={cn(centered && 'text-center')}>
      <div className={cn(logoGapClassName, 'flex', centered ? 'justify-center' : 'justify-start')}>
        <Image src="/dalgo_logo.svg" alt="Dalgo" width={80} height={90} className="text-primary" />
      </div>
      <h1 className="text-2xl font-bold text-foreground" data-testid={testId}>
        {title}
      </h1>
      {subtitle ? <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}
