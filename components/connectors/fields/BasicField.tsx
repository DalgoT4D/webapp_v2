'use client';

import { useState } from 'react';
import { Controller, type Control, type FieldValues } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { JsonSchemaType, type FieldNode } from '../types';
import { FieldLabel } from './FieldLabel';

interface BasicFieldProps {
  field: FieldNode;
  control: Control<FieldValues>;
  disabled?: boolean;
}

export function BasicField({ field, control, disabled }: BasicFieldProps) {
  const [showSecret, setShowSecret] = useState(false);
  const fieldPath = field.path.join('.');
  const placeholder =
    field.examples && field.examples.length > 0 ? String(field.examples[0]) : undefined;

  const validationRules = field.required ? { required: `${field.title} is required` } : undefined;

  return (
    <div data-testid={`field-${fieldPath}`}>
      <FieldLabel
        title={field.title}
        required={field.required}
        description={field.description}
        htmlFor={fieldPath}
      />
      <Controller
        name={fieldPath}
        control={control}
        defaultValue={field.default ?? ''}
        rules={validationRules}
        render={({ field: formField, fieldState }) => {
          const errorClass = fieldState.error ? 'border-destructive' : '';

          return (
            <>
              {/* Multiline fields use textarea */}
              {field.isMultiline ? (
                <Textarea
                  {...formField}
                  id={fieldPath}
                  data-testid={`input-${fieldPath}`}
                  placeholder={placeholder}
                  disabled={disabled}
                  rows={4}
                  className={`font-mono text-sm ${errorClass}`}
                />
              ) : field.isSecret ? (
                /* Secret fields with show/hide toggle */
                <div className="relative">
                  <Input
                    {...formField}
                    id={fieldPath}
                    data-testid={`input-${fieldPath}`}
                    type={showSecret ? 'text' : 'password'}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={`pr-10 ${errorClass}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showSecret ? 'Hide value' : 'Show value'}
                    data-testid={`toggle-secret-${fieldPath}`}
                  >
                    {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              ) : field.fieldType === JsonSchemaType.NUMBER ||
                field.fieldType === JsonSchemaType.INTEGER ? (
                /* Number/integer fields */
                <Input
                  {...formField}
                  id={fieldPath}
                  data-testid={`input-${fieldPath}`}
                  type="number"
                  placeholder={placeholder}
                  disabled={disabled}
                  min={field.minimum}
                  max={field.maximum}
                  step={field.fieldType === JsonSchemaType.INTEGER ? 1 : undefined}
                  onChange={(e) => formField.onChange(e.target.value)}
                  className={errorClass}
                />
              ) : (
                /* Default: string input */
                <Input
                  {...formField}
                  id={fieldPath}
                  data-testid={`input-${fieldPath}`}
                  type="text"
                  placeholder={placeholder}
                  disabled={disabled}
                  className={errorClass}
                />
              )}
              {fieldState.error && (
                <p className="text-xs text-destructive mt-1">{fieldState.error.message}</p>
              )}
            </>
          );
        }}
      />
      {field.patternDescriptor && (
        <p className="text-xs text-muted-foreground mt-1">Format: {field.patternDescriptor}</p>
      )}
    </div>
  );
}
