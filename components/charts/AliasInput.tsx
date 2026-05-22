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
}

export function AliasInput({ value, onChange, disabled, placeholder }: AliasInputProps) {
  const [localValue, setLocalValue] = useState(value);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debouncedUpdate = useRef(
    debounce((val: string) => onChangeRef.current(val), ALIAS_DEBOUNCE_MS)
  ).current;

  // Sync when external value changes (e.g. auto-generated alias after column change)
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  return (
    <Input
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
