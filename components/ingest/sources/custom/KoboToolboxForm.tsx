'use client';

import { renderField } from '@/components/connectors/ConnectorConfigForm';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { partitionFields } from './partition-fields';
import { StartTimeField } from './StartTimeField';
import { KOBO_KEY_START_TIME } from './constants';
import type { CustomSourceFormProps } from './types';

/** KoboToolbox: required fields + start_time up front; everything else in Advanced. */
export function KoboToolboxForm({
  parsedSpec,
  control,
  setValue,
  disabled,
}: CustomSourceFormProps) {
  const { primary, advanced } = partitionFields(parsedSpec.fields, {
    pinned: [KOBO_KEY_START_TIME],
  });

  return (
    <div className="space-y-4" data-testid="kobo-toolbox-form">
      {primary.map((field) =>
        field.path[field.path.length - 1] === KOBO_KEY_START_TIME ? (
          <StartTimeField
            key={field.path.join('.')}
            field={field}
            control={control}
            setValue={setValue}
            disabled={disabled}
          />
        ) : (
          renderField(field, control, setValue, disabled)
        )
      )}

      {advanced.length > 0 && (
        <Accordion type="single" collapsible data-testid="kobo-advanced">
          <AccordionItem value="advanced" className="border-none">
            <AccordionTrigger
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline"
              data-testid="kobo-advanced-trigger"
            >
              Advanced options
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              {advanced.map((field) => renderField(field, control, setValue, disabled))}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </div>
  );
}
