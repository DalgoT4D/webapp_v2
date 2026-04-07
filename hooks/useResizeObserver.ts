// hooks/useResizeObserver.ts
import { useState, useEffect, useRef, RefObject } from 'react';

interface UseResizeObserverResult<T extends HTMLElement> {
  ref: RefObject<T | null>;
  width: number;
  height: number;
}

export function useResizeObserver<T extends HTMLElement>(): UseResizeObserverResult<T> {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width: size.width, height: size.height };
}

export default useResizeObserver;
