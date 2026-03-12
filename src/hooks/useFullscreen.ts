'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type FullscreenType = 'dashboard' | 'chart' | null;

interface FullscreenState {
  isFullscreen: boolean;
  type: FullscreenType;
  elementRef: HTMLElement | null;
}

// Global state to prevent conflicts between components
let globalFullscreenState: FullscreenState = {
  isFullscreen: false,
  type: null,
  elementRef: null,
};

const listeners = new Set<(state: FullscreenState) => void>();

const notifyListeners = () => {
  listeners.forEach((listener) => listener(globalFullscreenState));
};

export function useFullscreen(type: 'dashboard' | 'chart') {
  const [localState, setLocalState] = useState<FullscreenState>(globalFullscreenState);
  const elementRef = useRef<HTMLElement | null>(null);

  // Subscribe to global state changes
  useEffect(() => {
    const listener = (state: FullscreenState) => {
      setLocalState(state);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  // Handle native fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!document.fullscreenElement;

      if (!isCurrentlyFullscreen && globalFullscreenState.isFullscreen) {
        // User exited fullscreen (e.g., pressed Escape)
        globalFullscreenState = {
          isFullscreen: false,
          type: null,
          elementRef: null,
        };
        notifyListeners();
      } else if (isCurrentlyFullscreen && document.fullscreenElement) {
        // Apply consistent styling when in fullscreen
        const fullscreenElement = document.fullscreenElement as HTMLElement;
        fullscreenElement.style.backgroundColor = 'white';
        fullscreenElement.style.background = 'white';

        // For charts, ensure proper sizing
        if (globalFullscreenState.type === 'chart') {
          fullscreenElement.style.padding = '16px';
          fullscreenElement.style.display = 'flex';
          fullscreenElement.style.flexDirection = 'column';
        }
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const enterFullscreen = useCallback(
    async (element: HTMLElement) => {
      // If another component is already in fullscreen, exit it first
      if (globalFullscreenState.isFullscreen && globalFullscreenState.type !== type) {
        await document.exitFullscreen();
        // Small delay to ensure clean transition
        await new Promise((resolve) => setTimeout(resolve, 100));
      }

      try {
        elementRef.current = element;
        await element.requestFullscreen();

        globalFullscreenState = {
          isFullscreen: true,
          type,
          elementRef: element,
        };

        notifyListeners();

        // Apply immediate styling
        setTimeout(() => {
          if (document.fullscreenElement) {
            const fullscreenElement = document.fullscreenElement as HTMLElement;
            fullscreenElement.style.backgroundColor = 'white';
            fullscreenElement.style.background = 'white';

            // For charts, ensure proper layout
            if (type === 'chart') {
              fullscreenElement.style.padding = '16px';
              fullscreenElement.style.display = 'flex';
              fullscreenElement.style.flexDirection = 'column';
            }
          }
        }, 50);
      } catch (error) {
        console.error('Failed to enter fullscreen:', error);
      }
    },
    [type]
  );

  const exitFullscreen = useCallback(async () => {
    if (globalFullscreenState.isFullscreen && globalFullscreenState.type === type) {
      try {
        await document.exitFullscreen();
        globalFullscreenState = {
          isFullscreen: false,
          type: null,
          elementRef: null,
        };
        elementRef.current = null;
        notifyListeners();
      } catch (error) {
        console.error('Failed to exit fullscreen:', error);
      }
    }
  }, [type]);

  const toggleFullscreen = useCallback(
    (element: HTMLElement) => {
      const isCurrentTypeFullscreen = localState.isFullscreen && localState.type === type;

      if (isCurrentTypeFullscreen) {
        exitFullscreen();
      } else {
        enterFullscreen(element);
      }
    },
    [localState.isFullscreen, localState.type, type, enterFullscreen, exitFullscreen]
  );

  // Check if this specific type is in fullscreen
  const isFullscreen = localState.isFullscreen && localState.type === type;

  // Check if any fullscreen is active (for preventing conflicts)
  const isAnyFullscreen = localState.isFullscreen;

  return {
    isFullscreen,
    isAnyFullscreen,
    toggleFullscreen,
    enterFullscreen,
    exitFullscreen,
  };
}
