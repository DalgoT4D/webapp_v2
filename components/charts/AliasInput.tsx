'use client';

import { useState, useEffect, useRef } from 'react';
import debounce from 'lodash/debounce';
import { Input } from '@/components/ui/input';

// Delay before propagating alias changes to parent to avoid chart reload on every keystroke
const ALIAS_DEBOUNCE_MS = 500;

interface AliasInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  'data-testid'?: string;
}

export function AliasInput({
  value,
  onChange,
  disabled,
  placeholder,
  id,
  'data-testid': dataTestId,
}: AliasInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debouncedUpdate = useRef(
    debounce((val: string) => onChangeRef.current(val), ALIAS_DEBOUNCE_MS)
  ).current;

  // Cancel any pending debounce when external value changes to prevent stale call
  useEffect(() => {
    debouncedUpdate.cancel();
    setLocalValue(value);
  }, [value, debouncedUpdate]);

  // Cancel pending debounce on unmount to prevent calling onChange after removal
  useEffect(() => {
    return () => debouncedUpdate.cancel();
  }, [debouncedUpdate]);

  return (
    <Input
      id={id}
      data-testid={dataTestId}
      type="text"
      placeholder={placeholder}
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value);
        debouncedUpdate(e.target.value);
      }}
      disabled={disabled}
      className="h-8 text-sm"
    />
  );
}
