'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { PRESET_COLORS, HEX_COLOR_REGEX } from './constants';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || '');

  const handleHexBlur = () => {
    if (HEX_COLOR_REGEX.test(hexInput)) {
      onChange(hexInput);
    }
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);
  };

  const handleSwatchClick = (hex: string) => {
    if (disabled) return;
    setHexInput(hex);
    onChange(hex);
  };

  return (
    <div className="space-y-2">
      {/* Preset color swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color, index) => (
          <button
            key={color.hex}
            type="button"
            data-testid={`color-swatch-${index}`}
            className={`w-7 h-7 rounded-md border transition-all ${
              value === color.hex
                ? 'ring-2 ring-primary ring-offset-1'
                : 'hover:ring-1 hover:ring-muted-foreground'
            }`}
            style={{ backgroundColor: color.hex }}
            onClick={() => handleSwatchClick(color.hex)}
            disabled={disabled}
            title={color.label}
            aria-label={color.label}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md border flex-shrink-0"
          style={{
            backgroundColor: HEX_COLOR_REGEX.test(hexInput) ? hexInput : '#FFFFFF',
          }}
        />
        <Input
          data-testid="color-hex-input"
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          placeholder="#AABBCC"
          disabled={disabled}
          className="h-8 text-sm font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}
