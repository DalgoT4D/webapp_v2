'use client';

import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Switch } from '@/components/ui/switch';
import type { FieldNode } from '../types';
import { FieldLabel } from './FieldLabel';

interface BooleanFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  disabled?: boolean;
}

export function BooleanField({ field, control, disabled }: BooleanFieldProps) {
  const fieldPath = field.path.join('.');

  return (
    <div className="flex items-center justify-between" data-testid={`field-${fieldPath}`}>
      <FieldLabel
        title={field.title}
        required={field.required}
        description={field.description}
        htmlFor={fieldPath}
      />
      <Controller
        name={fieldPath}
        control={control}
        defaultValue={field.default ?? false}
        render={({ field: formField }) => (
          <Switch
            id={fieldPath}
            data-testid={`switch-${fieldPath}`}
            checked={formField.value}
            onCheckedChange={formField.onChange}
            disabled={disabled}
          />
        )}
      />
    </div>
  );
}
