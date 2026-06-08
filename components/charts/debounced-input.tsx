'use client';

import { useState, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/useDebounce';

const DEFAULT_DEBOUNCE_MS = 500;

interface DebouncedInputProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  'data-testid'?: string;
  className?: string;
  type?: string;
}

export function DebouncedInput({
  value,
  onChange,
  debounceMs = DEFAULT_DEBOUNCE_MS,
  disabled,
  placeholder,
  id,
  'data-testid': dataTestId,
  className,
  type = 'text',
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const debouncedValue = useDebounce(localValue, debounceMs);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const isFirstRender = useRef(true);

  // Sync when external value changes (e.g., auto-generated values)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Propagate debounced value to parent, skipping initial mount
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    onChangeRef.current(debouncedValue);
  }, [debouncedValue]);

  return (
    <Input
      id={id}
      data-testid={dataTestId}
      type={type}
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      disabled={disabled}
      className={className}
    />
  );
}
