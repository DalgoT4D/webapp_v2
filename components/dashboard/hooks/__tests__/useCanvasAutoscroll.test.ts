import { act, renderHook } from '@testing-library/react';
import { useCanvasAutoscroll } from '@/components/dashboard/hooks/useCanvasAutoscroll';

const FRAME_MS = 16;

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

function setup() {
  const canvas = {
    getBoundingClientRect: () => ({ top: 0, bottom: 600 }),
    scrollTop: 100,
  } as unknown as HTMLDivElement;
  const hook = renderHook(() => useCanvasAutoscroll({ current: canvas }));
  return { canvas, ...hook };
}

describe('useCanvasAutoscroll', () => {
  it('scrolls toward the edge the pointer is near, faster the closer it is', () => {
    const { canvas, result } = setup();
    result.current.autoscrollPointerYRef.current = 570; // 30px from the bottom → half speed
    act(() => result.current.startAutoscroll());
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(canvas.scrollTop).toBe(115);

    result.current.autoscrollPointerYRef.current = 30; // 30px from the top
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(canvas.scrollTop).toBe(100);

    result.current.autoscrollPointerYRef.current = 300; // middle: no scroll
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(canvas.scrollTop).toBe(100);
  });

  it('starting twice runs one loop; stop cancels it and forgets the pointer', () => {
    const { canvas, result } = setup();
    result.current.autoscrollPointerYRef.current = 570;
    act(() => {
      result.current.startAutoscroll();
      result.current.startAutoscroll();
    });
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(canvas.scrollTop).toBe(115);
    act(() => result.current.stopAutoscroll());
    expect(result.current.autoscrollPointerYRef.current).toBeNull();
    act(() => jest.advanceTimersByTime(FRAME_MS * 5));
    expect(canvas.scrollTop).toBe(115);
  });

  it('caps the speed at 30px per frame at the very edge', () => {
    const { canvas, result } = setup();
    result.current.autoscrollPointerYRef.current = 600;
    act(() => result.current.startAutoscroll());
    act(() => jest.advanceTimersByTime(FRAME_MS));
    expect(canvas.scrollTop).toBe(130);
  });
});
