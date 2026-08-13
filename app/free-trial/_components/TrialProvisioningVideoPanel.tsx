'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

const PRODUCT_VIDEO_ID = 'R-JJNgp8xYM';
const PRODUCT_VIDEO_EMBED_URL = `https://www.youtube-nocookie.com/embed/${PRODUCT_VIDEO_ID}?autoplay=1&rel=0`;
const PRODUCT_VIDEO_THUMBNAIL_URL = `https://i.ytimg.com/vi/${PRODUCT_VIDEO_ID}/hqdefault.jpg`;

export function TrialProvisioningVideoPanel() {
  const [videoStarted, setVideoStarted] = useState(false);

  const handlePlay = () => {
    trackEvent(ANALYTICS_EVENTS.TRIAL_PROVISIONING_VIDEO_PLAYED);
    setVideoStarted(true);
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
          {videoStarted ? (
            <iframe
              data-testid="trial-provisioning-video-iframe"
              src={PRODUCT_VIDEO_EMBED_URL}
              title="Dalgo product overview"
              allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <button
              type="button"
              aria-label="Play Dalgo product overview video"
              data-testid="trial-provisioning-video-play"
              onClick={handlePlay}
              className="flex h-full w-full items-center justify-center bg-cover bg-center"
              style={{ backgroundImage: `url(${PRODUCT_VIDEO_THUMBNAIL_URL})` }}
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white shadow-lg">
                <Play className="h-6 w-6 text-primary" fill="currentColor" aria-hidden="true" />
              </span>
            </button>
          )}
        </div>
      </div>

      <p className="relative mt-8 text-center text-sm font-medium text-[#036057]">
        Dalgo brings all your NGO&apos;s scattered data into one unified view. You are moments away
        from leaving manual spreadsheets behind and tracking your true impact.
      </p>
    </div>
  );
}
