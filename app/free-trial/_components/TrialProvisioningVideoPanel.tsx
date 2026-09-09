'use client';

import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { PRODUCT_VIDEO_ID } from '@/constants/trial';
import { YouTubeVideoPlayer } from '@/components/onboarding/youtube-video-player';

export function TrialProvisioningVideoPanel() {
  const handlePlay = () => {
    trackEvent(ANALYTICS_EVENTS.TRIAL_PROVISIONING_VIDEO_PLAYED);
  };

  return (
    <div
      data-testid="trial-provisioning-video-panel"
      className="relative flex h-full flex-col justify-between overflow-hidden bg-gradient-to-br from-[#e8f7f2] via-[#d5f0e6] to-[#b8e6d4] p-10"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-24 -top-32 h-[420px] w-[420px] rounded-full bg-white/40 blur-3xl"
      />

      <div className="relative flex flex-1 items-center justify-center">
        <div className="aspect-video w-full max-w-[520px] overflow-hidden rounded-lg border-4 border-black bg-primary/10 shadow-2xl">
          <YouTubeVideoPlayer
            videoId={PRODUCT_VIDEO_ID}
            title="Dalgo product overview video"
            testIdPrefix="trial-provisioning-video"
            onPlay={handlePlay}
          />
        </div>
      </div>

      <p className="relative mt-8 text-center text-sm font-medium text-[#036057]">
        Dalgo brings all your NGO&apos;s scattered data into one unified view. You are moments away
        from leaving manual spreadsheets behind and tracking your true impact.
      </p>
    </div>
  );
}
