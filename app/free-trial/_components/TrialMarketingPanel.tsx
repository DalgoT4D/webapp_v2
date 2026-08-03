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

  // Figma frame 2452:217 ("intro") positions the headline (node 2452:223) and the
  // bordered screenshot (node 2850:1047) with absolute coordinates on a canvas wider
  // than the visible pane — the image is meant to bleed past the right edge and get
  // clipped by TrialSplitCard's overflow-hidden card. Pixel values are inlined straight
  // from that frame, same convention as TrialSplitCard's own "numbers baked in" comment.
  if (isTop) {
    return (
      <div
        data-testid="trial-marketing-panel"
        className="relative h-full overflow-hidden bg-gradient-to-br from-[#d5f0e6] via-[#c5e9da] to-[#b8e6d4]"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-white/40 blur-3xl"
        />
        <div className="absolute left-[69px] top-[90px] flex w-[477px] flex-col items-start gap-4">
          {panel.headline ? (
            <h2 className="text-xl font-bold text-[#0f2b45]">{panel.headline}</h2>
          ) : null}
          <p className="text-sm font-medium leading-[1.5] text-[#036057]">{panel.subline}</p>
        </div>
        <div className="absolute left-[69px] top-[240px] h-[592px] w-[1039px] overflow-hidden rounded-[20px] border-8 border-black shadow-2xl">
          <Image
            src={panel.imageSrc}
            alt={panel.imageAlt}
            fill
            sizes="1039px"
            priority={priority}
            className="object-cover object-top"
          />
        </div>
      </div>
    );
  }

  const image = (
    <div className="relative flex flex-1 items-center justify-center">
      <Image
        src={panel.imageSrc}
        alt={panel.imageAlt}
        width={1052}
        height={958}
        sizes="587px"
        priority={priority}
        className="w-full max-w-[520px] rounded-lg border-4 border-black shadow-2xl"
      />
    </div>
  );

  const text = (
    <div className="relative mt-8 text-center">
      {panel.headline ? (
        <h2 className="text-xl font-bold text-[#0f2b45]">{panel.headline}</h2>
      ) : null}
      <p className={cn('text-sm font-medium text-[#036057]', panel.headline && 'mt-3')}>
        {panel.subline}
      </p>

      {panel.activeDot !== null ? (
        <div
          className="mt-6 flex justify-center gap-1"
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
      className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#e8f7f2] via-[#d5f0e6] to-[#b8e6d4] p-10"
    >
      {/* Decorative wash echoing the Figma ellipses. aria-hidden — purely visual. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-white/40 blur-3xl"
      />
      {image}
      {text}
    </div>
  );
}
