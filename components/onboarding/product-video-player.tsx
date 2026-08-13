'use client';

import { useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProductVideoPlayerProps {
  videoSrc: string;
  posterSrc: string;
  title: string;
  testIdPrefix: string;
  onFirstPlay: () => void;
  playButtonSize?: 'default' | 'compact';
  className?: string;
}

/**
 * Native product-video player with Dalgo-owned play/pause controls. Keeping the
 * media self-hosted avoids third-party branding, recommendations, and menus in
 * the compact trial surfaces.
 */
export function ProductVideoPlayer({
  videoSrc,
  posterSrc,
  title,
  testIdPrefix,
  onFirstPlay,
  playButtonSize = 'default',
  className,
}: ProductVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasTrackedFirstPlay = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleTogglePlayback = async () => {
    const video = videoRef.current;
    if (!video) return;

    if (!isPlaying) {
      try {
        await video.play();
        setIsPlaying(true);
        if (!hasTrackedFirstPlay.current) {
          hasTrackedFirstPlay.current = true;
          onFirstPlay();
        }
      } catch {
        setIsPlaying(false);
      }
    } else {
      video.pause();
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
        playsInline
        className="pointer-events-none h-full w-full object-cover"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      />
      <button
        type="button"
        aria-label={isPlaying ? `Pause ${title}` : `Play ${title}`}
        data-testid={isPlaying ? `${testIdPrefix}-toggle` : `${testIdPrefix}-play`}
        onClick={handleTogglePlayback}
        className="absolute inset-0 z-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
      >
        <span
          className={cn(
            'absolute flex items-center justify-center rounded-full bg-background/95 text-primary shadow-lg transition-opacity',
            isPlaying
              ? 'bottom-3 left-3 h-9 w-9 opacity-75 hover:opacity-100'
              : cn('left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2', initialButtonSize)
          )}
          aria-hidden="true"
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" fill="currentColor" />
          ) : (
            <Play className={playIconSize} fill="currentColor" />
          )}
        </span>
      </button>
    </div>
  );
}
