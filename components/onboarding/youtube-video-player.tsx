'use client';

import { useState } from 'react';
import { Play } from 'lucide-react';
import { cn } from '@/lib/utils';

interface YouTubeVideoPlayerProps {
  videoId: string;
  title: string;
  testIdPrefix: string;
  onPlay: () => void;
  playButtonSize?: 'default' | 'compact';
  className?: string;
}

/**
 * Click-to-load YouTube player. Until the user clicks, only the thumbnail image is
 * fetched — the iframe (and with it YouTube's scripts and cookies) mounts on play, not
 * on render, so a panel that merely sits open costs nothing. `youtube-nocookie.com`
 * keeps that first load out of YouTube's ad-tracking cookies.
 *
 * Playback state lives here rather than in the caller, so a parent that needs to stop
 * the video (the getting-started widget, on minimize) remounts this via `key` instead of
 * threading a reset prop through.
 */
export function YouTubeVideoPlayer({
  videoId,
  title,
  testIdPrefix,
  onPlay,
  playButtonSize = 'default',
  className,
}: YouTubeVideoPlayerProps) {
  const [started, setStarted] = useState(false);

  const handlePlay = () => {
    setStarted(true);
    onPlay();
  };

  const buttonSize = playButtonSize === 'compact' ? 'h-12 w-12' : 'h-14 w-14';
  const iconSize = playButtonSize === 'compact' ? 'h-5 w-5' : 'h-6 w-6';

  if (started) {
    return (
      <iframe
        data-testid={`${testIdPrefix}-iframe`}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`}
        title={title}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        className={cn('h-full w-full border-0', className)}
      />
    );
  }

  return (
    <button
      type="button"
      aria-label={`Play ${title}`}
      data-testid={`${testIdPrefix}-play`}
      onClick={handlePlay}
      className={cn(
        'flex h-full w-full items-center justify-center bg-cover bg-center',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
        className
      )}
      style={{ backgroundImage: `url(https://i.ytimg.com/vi/${videoId}/hqdefault.jpg)` }}
    >
      <span
        className={cn(
          'flex items-center justify-center rounded-full bg-background shadow-lg',
          buttonSize
        )}
        aria-hidden="true"
      >
        <Play className={cn(iconSize, 'text-primary')} fill="currentColor" />
      </span>
    </button>
  );
}
