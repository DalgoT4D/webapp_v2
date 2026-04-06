// components/transform/canvas/forms/shared/OperandInput.tsx
'use client';

import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';

export interface OperandValue {
  value: string | number;
  is_col: boolean;
}

interface OperandInputProps {
  /** Current operand value */
  value: OperandValue;
  /** Change handler */
  onChange: (value: OperandValue) => void;
  /** Available columns for column mode */
  columns: string[];
  /** Placeholder for value input */
  placeholder?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class names */
  className?: string;
  /** Test ID prefix */
  testIdPrefix?: string;
  /** Input type for value mode */
  inputType?: 'text' | 'number';
}

/**
 * A reusable component that toggles between column selection and value input.
 * Used across multiple operation forms for operand inputs.
 */
export function OperandInput({
  value,
  onChange,
  columns,
  placeholder = 'Enter value',
  disabled = false,
  className,
  testIdPrefix = 'operand',
  inputType = 'text',
}: OperandInputProps) {
  const handleModeChange = (mode: string) => {
    onChange({
      value: '',
      is_col: mode === 'col',
    });
  };

  const handleValueChange = (newValue: string) => {
    onChange({
      ...value,
      value: inputType === 'number' ? (newValue ? Number(newValue) : '') : newValue,
    });
  };

  const handleColumnChange = (column: string) => {
    onChange({
      ...value,
      value: column,
    });
  };

  return (
    <div className={cn('flex items-center gap-3', className)}>
      {/* Col/Val Toggle */}
      <RadioGroup
        value={value.is_col ? 'col' : 'val'}
        onValueChange={handleModeChange}
        className="flex items-center gap-2"
        disabled={disabled}
      >
        <div className="flex items-center gap-1">
          <RadioGroupItem
            value="col"
            id={`${testIdPrefix}-col`}
            data-testid={`${testIdPrefix}-col-radio`}
          />
          <Label htmlFor={`${testIdPrefix}-col`} className="text-sm font-normal cursor-pointer">
            Col
          </Label>
        </div>
        <div className="flex items-center gap-1">
          <RadioGroupItem
            value="val"
            id={`${testIdPrefix}-val`}
            data-testid={`${testIdPrefix}-val-radio`}
          />
          <Label htmlFor={`${testIdPrefix}-val`} className="text-sm font-normal cursor-pointer">
            Val
          </Label>
        </div>
      </RadioGroup>

      {/* Input or Column Select */}
      {value.is_col ? (
        <Select value={String(value.value)} onValueChange={handleColumnChange} disabled={disabled}>
          <SelectTrigger className="flex-1" data-testid={`${testIdPrefix}-column-select`}>
            <SelectValue placeholder="Select column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map((col) => (
              <SelectItem key={col} value={col}>
                {col}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          type={inputType}
          value={String(value.value)}
          onChange={(e) => handleValueChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="flex-1"
          data-testid={`${testIdPrefix}-value-input`}
        />
      )}
    </div>
  );
}

/**
 * Parse string value for null/undefined handling
 */
export function parseStringForNull(value: string): string | null {
  if (value === '' || value === 'null' || value === 'NULL') return null;
  return value;
}
