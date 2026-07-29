// Right-hand marketing pane of the split card. Content comes from a config object
// (TRIAL_MARKETING_PANELS) rather than individual props, so TrialSplitCard stays
// content-agnostic and each screen picks its panel at the call site.
//
// No hooks, no state — see the note in TrialSplitCard.tsx.

import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  TRIAL_PANEL_DOT_COUNT,
  type TrialMarketingPanelConfig,
} from '@/app/free-trial/_lib/constants';

interface TrialMarketingPanelProps {
  panel: TrialMarketingPanelConfig;
  /** Only the first screen a visitor sees should preload its image. */
  priority?: boolean;
}

// Stable keys for the carousel indicator — never the array index.
const DOT_INDEXES = Array.from({ length: TRIAL_PANEL_DOT_COUNT }, (_, i) => i);

export function TrialMarketingPanel({ panel, priority = false }: TrialMarketingPanelProps) {
  const isTop = panel.textPosition === 'top';

  const image = (
    <div className={cn('relative flex flex-1 items-center justify-center', isTop && 'mt-8')}>
      <Image
        src={panel.imageSrc}
        alt={panel.imageAlt}
        width={640}
        height={420}
        sizes="587px"
        priority={priority}
        className="w-full max-w-[520px] rounded-lg border-4 border-black shadow-2xl"
      />
    </div>
  );

  const text = (
    <div className={cn('relative', isTop ? 'text-left' : 'mt-8 text-center')}>
      {panel.headline ? (
        <h2 className="text-xl font-bold text-[#0f2b45]">{panel.headline}</h2>
      ) : null}
      <p className={cn('text-sm font-medium text-[#036057]', panel.headline && 'mt-3')}>
        {panel.subline}
      </p>

      {panel.activeDot !== null ? (
        <div
          className={cn('mt-6 flex gap-1', isTop ? 'justify-start' : 'justify-center')}
          role="presentation"
          data-testid="trial-panel-dots"
        >
          {DOT_INDEXES.map((index) => (
            <span
              key={`trial-panel-dot-${index}`}
              className={cn(
                'h-1 w-10 rounded-full',
                index === panel.activeDot ? 'bg-primary' : 'bg-white/70'
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );

  return (
    <div
      data-testid="trial-marketing-panel"
      className={cn(
        'relative flex h-full overflow-hidden bg-gradient-to-br from-[#e8f7f2] via-[#d5f0e6] to-[#b8e6d4] p-10',
        isTop ? 'flex-col' : 'flex-col justify-between'
      )}
    >
      {/* Decorative wash echoing the Figma ellipses. aria-hidden — purely visual. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-white/40 blur-3xl"
      />

      {isTop ? (
        <>
          {text}
          {image}
        </>
      ) : (
        <>
          {image}
          {text}
        </>
      )}
    </div>
  );
}
