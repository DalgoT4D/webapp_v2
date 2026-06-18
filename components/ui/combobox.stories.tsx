import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { Combobox, type ComboboxItem } from './combobox';

// A realistic set of warehouse datasets a user would pick from in the chart builder.
const DATASETS: ComboboxItem[] = [
  { value: 'beneficiaries', label: 'beneficiaries' },
  { value: 'survey_responses', label: 'survey_responses' },
  { value: 'field_visits', label: 'field_visits' },
  { value: 'health_outcomes', label: 'health_outcomes' },
  { value: 'enrollment_2026', label: 'enrollment_2026' },
];

// Single-select Combobox is controlled via value/onValueChange.
function ComboboxDemo({
  initialValue = '',
  disabled,
}: {
  initialValue?: string;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div style={{ width: 320 }} data-testid="combobox-demo">
      <Combobox
        items={DATASETS}
        value={value}
        onValueChange={setValue}
        placeholder="Select a dataset"
        disabled={disabled}
      />
    </div>
  );
}

// Multi-select Combobox is controlled via values/onValuesChange.
function MultiComboboxDemo({ initialValues = [] }: { initialValues?: string[] }) {
  const [values, setValues] = useState<string[]>(initialValues);
  return (
    <div style={{ width: 320 }} data-testid="combobox-multi-demo">
      <Combobox
        mode="multi"
        items={DATASETS}
        values={values}
        onValuesChange={setValues}
        searchPlaceholder="Select datasets"
      />
    </div>
  );
}

const meta = {
  title: 'UI/Combobox',
  component: Combobox,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single-select, empty. Type to filter; matches are highlighted. */
export const Default: Story = {
  render: () => <ComboboxDemo />,
};

/** Single-select with a pre-selected dataset. */
export const Prefilled: Story = {
  render: () => <ComboboxDemo initialValue="survey_responses" />,
};

/** Disabled single-select — the input is non-interactive. */
export const Disabled: Story = {
  render: () => <ComboboxDemo initialValue="beneficiaries" disabled />,
};

/** Multi-select with chips, "Select all", and checkboxes. */
export const MultiSelect: Story = {
  render: () => <MultiComboboxDemo initialValues={['beneficiaries', 'field_visits']} />,
};
