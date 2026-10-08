import { useEffect, useRef, useState } from 'react';

/**
 * `value`, delayed by `delayMs`; `onSettle` runs each time the timer fires.
 * The timer also runs once after mount (the reports list relies on that — pinned).
 * `value` must be referentially stable between renders (wrap objects in useMemo),
 * otherwise the timer restarts on every render.
 */
export function useDebouncedValue<T>(value: T, delayMs: number, onSettle?: () => void): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  // Latest callback without restarting the timer when the caller passes a new function.
  const onSettleRef = useRef(onSettle);
  useEffect(() => {
    onSettleRef.current = onSettle;
  }, [onSettle]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
      onSettleRef.current?.();
    }, delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}
