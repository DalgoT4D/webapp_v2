'use client';

import { PRESET_COLORS } from './constants';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const handleSwatchClick = (hex: string) => {
    if (disabled) return;
    onChange(hex);
  };

  return (
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
  );
}
