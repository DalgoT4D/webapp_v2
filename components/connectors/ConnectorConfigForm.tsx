'use client';

import { type ReactNode } from 'react';
import { type Control, type FieldValues, type UseFormSetValue } from 'react-hook-form';
import type { FieldNode, ParsedSpec } from './types';
import { BasicField } from './fields/BasicField';
import { BooleanField } from './fields/BooleanField';
import { EnumField } from './fields/EnumField';
import { OneOfField } from './fields/OneOfField';
import { ArrayField } from './fields/ArrayField';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';

interface ConnectorConfigFormProps {
  parsedSpec: ParsedSpec;
  control: Control<FieldValues>;
  setValue: UseFormSetValue<FieldValues>;
  disabled?: boolean;
}

/**
 * Render a single FieldNode into the appropriate field component.
 * Exported so that OneOfField and ArrayField can call it recursively.
 */
export function renderField(
  field: FieldNode,
  control: Control<FieldValues>,
  setValue: UseFormSetValue<FieldValues>,
  disabled?: boolean
): ReactNode {
  const key = field.path.join('.');

  switch (field.type) {
    case 'basic':
      return <BasicField key={key} field={field} control={control} disabled={disabled} />;
    case 'boolean':
      return <BooleanField key={key} field={field} control={control} disabled={disabled} />;
    case 'enum':
      return <EnumField key={key} field={field} control={control} disabled={disabled} />;
    case 'oneOf':
      return (
        <OneOfField
          key={key}
          field={field}
          control={control}
          setValue={setValue}
          disabled={disabled}
        />
      );
    case 'array':
      return (
        <ArrayField
          key={key}
          field={field}
          control={control}
          setValue={setValue}
          disabled={disabled}
        />
      );
    default:
      return null;
  }
}

/**
 * Top-level connector config form that renders a ParsedSpec.
 * Supports both group-based and flat layouts.
 */
export function ConnectorConfigForm({
  parsedSpec,
  control,
  setValue,
  disabled,
}: ConnectorConfigFormProps) {
  const { groups, fields } = parsedSpec;

  // Group-based rendering
  if (groups.length > 0) {
    // Partition fields by group
    const grouped = new Map<string, FieldNode[]>();
    const ungrouped: FieldNode[] = [];

    for (const field of fields) {
      if (field.group) {
        const existing = grouped.get(field.group) || [];
        existing.push(field);
        grouped.set(field.group, existing);
      } else {
        ungrouped.push(field);
      }
    }

    return (
      <div className="space-y-6" data-testid="connector-config-form">
        {groups.map((group) => {
          const groupFields = grouped.get(group.id);
          if (!groupFields || groupFields.length === 0) return null;

          const isAdvanced = group.id === 'advanced';

          if (isAdvanced) {
            return (
              <Accordion
                key={group.id}
                type="single"
                collapsible
                data-testid={`field-group-${group.id}`}
              >
                <AccordionItem value="advanced" className="border-none">
                  <AccordionTrigger
                    className="text-base font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline"
                    data-testid="advanced-section-trigger"
                  >
                    {group.title || 'Advanced'}
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 rounded-md border border-border p-4 bg-muted/50">
                      {groupFields.map((field) => renderField(field, control, setValue, disabled))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            );
          }

          return (
            <div key={group.id} data-testid={`field-group-${group.id}`}>
              {group.title && (
                <h3 className="text-base font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {group.title}
                </h3>
              )}
              <div className="space-y-4 rounded-md border border-border p-4 bg-muted/50">
                {groupFields.map((field) => renderField(field, control, setValue, disabled))}
              </div>
            </div>
          );
        })}

        {/* Ungrouped fields at the end */}
        {ungrouped.length > 0 && (
          <div className="space-y-4">
            {ungrouped.map((field) => renderField(field, control, setValue, disabled))}
          </div>
        )}
      </div>
    );
  }

  // Flat layout (no groups)
  return (
    <div className="space-y-4" data-testid="connector-config-form">
      {fields.map((field) => renderField(field, control, setValue, disabled))}
    </div>
  );
}
