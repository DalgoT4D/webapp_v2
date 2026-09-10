import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server.node';
import { ProductVideoPlayer } from '../product-video-player';

const props = {
  autoPlay: true,
  videoSrc: '/video.mp4',
  posterSrc: '/poster.jpg',
  title: 'Product tour',
  testIdPrefix: 'tour',
};

it('recognizes autoplay before hydration and records first play only once', async () => {
  const onFirstPlay = jest.fn();
  const player = (
    <StrictMode>
      <ProductVideoPlayer {...props} onFirstPlay={onFirstPlay} />
    </StrictMode>
  );
  const container = document.createElement('div');
  document.body.appendChild(container);
  container.innerHTML = renderToString(player);
  const video = container.querySelector('video')!;
  Object.defineProperty(video, 'paused', { configurable: true, value: false });
  video.dispatchEvent(new Event('play'));
  let root!: ReturnType<typeof hydrateRoot>;
  await act(async () => {
    root = hydrateRoot(container, player);
  });
  try {
    expect(video.paused).toBe(false);
    expect(screen.queryByRole('button', { name: 'Play Product tour' })).not.toBeInTheDocument();
    expect(onFirstPlay).toHaveBeenCalledTimes(1);
    fireEvent.pause(video);
    expect(screen.getByRole('button', { name: 'Play Product tour' })).toBeInTheDocument();
    fireEvent.play(video);
    expect(screen.queryByRole('button', { name: 'Play Product tour' })).not.toBeInTheDocument();
    fireEvent.ended(video);
    expect(screen.getByRole('button', { name: 'Play Product tour' })).toBeInTheDocument();
    expect(onFirstPlay).toHaveBeenCalledTimes(1);
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('retains the fallback when autoplay and the first manual attempt are blocked', async () => {
  const onFirstPlay = jest.fn();
  const play = jest
    .spyOn(HTMLMediaElement.prototype, 'play')
    .mockRejectedValueOnce(new Error('Playback blocked'))
    .mockResolvedValueOnce(undefined);
  try {
    render(<ProductVideoPlayer {...props} onFirstPlay={onFirstPlay} />);
    const button = screen.getByRole('button', { name: 'Play Product tour' });
    expect(onFirstPlay).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(button));
    expect(button).toBeInTheDocument();
    expect(onFirstPlay).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(button));
    expect(screen.queryByRole('button', { name: 'Play Product tour' })).not.toBeInTheDocument();
    expect(onFirstPlay).toHaveBeenCalledTimes(1);
  } finally {
    play.mockRestore();
  }
});

it('keeps the Get Started player click-to-play', () => {
  const onFirstPlay = jest.fn();
  render(<ProductVideoPlayer {...props} autoPlay={false} onFirstPlay={onFirstPlay} />);
  const video = screen.getByTestId('tour-video') as HTMLVideoElement;
  expect(video.autoplay).toBe(false);
  expect(video.muted).toBe(false);
  expect(screen.getByRole('button', { name: 'Play Product tour' })).toBeInTheDocument();
  expect(onFirstPlay).not.toHaveBeenCalled();
});
