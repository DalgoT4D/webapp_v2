'use client';

import { useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductVideoPlayerProps {
  videoSrc: string;
  posterSrc: string;
  title: string;
  testIdPrefix: string;
  onFirstPlay: () => void;
  autoPlay?: boolean;
  playButtonSize?: 'default' | 'compact';
  className?: string;
}

/**
 * Native product-video player with a branded paused-state control and the browser's
 * volume, timeline, picture-in-picture and fullscreen controls always visible.
 * Self-hosting keeps the poster reliable and removes the third-party interstitial.
 */
export function ProductVideoPlayer({
  videoSrc,
  posterSrc,
  title,
  testIdPrefix,
  onFirstPlay,
  autoPlay = false,
  playButtonSize = 'default',
  className,
}: ProductVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasTrackedFirstPlay = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const trackFirstPlay = () => {
    if (hasTrackedFirstPlay.current) return;
    hasTrackedFirstPlay.current = true;
    onFirstPlay();
  };

  const handlePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setIsPlaying(true);
      trackFirstPlay();
    } catch {
      setIsPlaying(false);
    }
  };

  const playIconSize = playButtonSize === 'compact' ? 'h-5 w-5' : 'h-6 w-6';
  const initialButtonSize = playButtonSize === 'compact' ? 'h-12 w-12' : 'h-14 w-14';

  return (
    <div
      id={`${testIdPrefix}-player`}
      data-testid={`${testIdPrefix}-player`}
      className={cn('relative h-full w-full overflow-hidden', className)}
    >
      <video
        ref={videoRef}
        data-testid={`${testIdPrefix}-video`}
        src={videoSrc}
        poster={posterSrc}
        aria-label={title}
        preload="metadata"
        autoPlay={autoPlay}
        muted={autoPlay}
        playsInline
        controls
        controlsList="nodownload"
        className="h-full w-full object-cover"
        onPlay={() => {
          setIsPlaying(true);
          trackFirstPlay();
        }}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      {!isPlaying && (
        <button
          type="button"
          aria-label={`Play ${title}`}
          data-testid={`${testIdPrefix}-play`}
          onClick={handlePlay}
          className="group absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 cursor-pointer flex-col items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
        >
          <span
            className={cn(
              'flex items-center justify-center rounded-full bg-background/95 text-primary shadow-lg transition-transform group-hover:scale-105',
              initialButtonSize
            )}
            aria-hidden="true"
          >
            <Play className={playIconSize} fill="currentColor" />
          </span>
          <span className="rounded-full bg-black/75 px-3 py-1 text-xs font-semibold text-white shadow-md">
            Watch video
          </span>
        </button>
      )}
    </div>
  );
}
