import { renderHook, act } from '@testing-library/react';
import { useFullscreen } from '@/hooks/useFullscreen';

// Mock the requestFullscreen and exitFullscreen APIs
const mockRequestFullscreen = jest.fn();
const mockExitFullscreen = jest.fn();

// Mock document.fullscreenElement
let mockFullscreenElement: Element | null = null;

Object.defineProperty(document, 'fullscreenElement', {
  get: () => mockFullscreenElement,
  configurable: true,
});

Object.defineProperty(document, 'requestFullscreen', {
  value: mockRequestFullscreen,
  configurable: true,
});

Object.defineProperty(document, 'exitFullscreen', {
  value: mockExitFullscreen,
  configurable: true,
});

// Mock HTMLElement.requestFullscreen
HTMLElement.prototype.requestFullscreen = mockRequestFullscreen;

describe('useFullscreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFullscreenElement = null;
    mockRequestFullscreen.mockResolvedValue(undefined);
    mockExitFullscreen.mockResolvedValue(undefined);
  });

  it('should initialize with correct default values', () => {
    const { result } = renderHook(() => useFullscreen('dashboard'));

    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.isAnyFullscreen).toBe(false);
    expect(typeof result.current.toggleFullscreen).toBe('function');
    expect(typeof result.current.enterFullscreen).toBe('function');
    expect(typeof result.current.exitFullscreen).toBe('function');
  });

  it('should enter fullscreen correctly', async () => {
    const { result } = renderHook(() => useFullscreen('dashboard'));
    const mockElement = document.createElement('div');

    await act(async () => {
      await result.current.enterFullscreen(mockElement);
    });

    expect(mockRequestFullscreen).toHaveBeenCalledWith();
  });

  it('should handle multiple fullscreen types correctly', () => {
    const { result: dashboardResult } = renderHook(() => useFullscreen('dashboard'));
    const { result: chartResult } = renderHook(() => useFullscreen('chart'));

    // Initially both should be false
    expect(dashboardResult.current.isFullscreen).toBe(false);
    expect(chartResult.current.isFullscreen).toBe(false);
    expect(dashboardResult.current.isAnyFullscreen).toBe(false);
    expect(chartResult.current.isAnyFullscreen).toBe(false);
  });

  it('should toggle fullscreen correctly', async () => {
    const { result } = renderHook(() => useFullscreen('dashboard'));
    const mockElement = document.createElement('div');

    // Test entering fullscreen
    await act(async () => {
      result.current.toggleFullscreen(mockElement);
    });

    expect(mockRequestFullscreen).toHaveBeenCalledWith();
  });

  it('should prevent conflicts between different fullscreen types', async () => {
    const { result: dashboardResult } = renderHook(() => useFullscreen('dashboard'));
    const { result: chartResult } = renderHook(() => useFullscreen('chart'));

    const mockElement1 = document.createElement('div');
    const mockElement2 = document.createElement('div');

    // First enter dashboard fullscreen
    await act(async () => {
      await dashboardResult.current.enterFullscreen(mockElement1);
    });

    // Then try to enter chart fullscreen - should exit dashboard first
    await act(async () => {
      await chartResult.current.enterFullscreen(mockElement2);
    });

    // Should have called exit and then request again
    expect(mockExitFullscreen).toHaveBeenCalled();
    expect(mockRequestFullscreen).toHaveBeenCalledTimes(2);
  });
});
