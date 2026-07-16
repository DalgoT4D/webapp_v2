import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldValues } from 'react-hook-form';
import { KoboToolboxForm } from '../KoboToolboxForm';
import type { ParsedSpec, FieldNode } from '@/components/connectors/types';

function basic(key: string, required: boolean, order: number): FieldNode {
  return {
    type: 'basic',
    path: [key],
    title: key,
    required,
    hidden: false,
    fieldType: 'string',
    order,
  };
}

const spec: ParsedSpec = {
  groups: [],
  fields: [
    basic('username', true, 1),
    basic('password', true, 2),
    { ...basic('start_time', false, 4), default: '2023-03-15T00:00:00' },
    {
      type: 'array',
      path: ['exclude_fields'],
      title: 'Exclude Fields',
      required: false,
      hidden: false,
      order: 5,
    },
  ],
};

function Harness() {
  const { control, setValue } = useForm<FieldValues>({
    defaultValues: { start_time: '2023-03-15T00:00:00' },
  });
  return <KoboToolboxForm parsedSpec={spec} control={control} setValue={setValue} mode="create" />;
}

describe('KoboToolboxForm', () => {
  it('renders required fields + start_time in the primary area', () => {
    render(<Harness />);
    expect(screen.getByText('username')).toBeInTheDocument();
    expect(screen.getByText('password')).toBeInTheDocument();
    expect(screen.getByTestId('start-time-field')).toBeInTheDocument();
  });

  it('keeps non-required fields behind the Advanced section until expanded', async () => {
    render(<Harness />);
    // Radix Accordion unmounts collapsed content — the field is absent until opened.
    expect(screen.queryByText('Exclude Fields')).not.toBeInTheDocument();
    await userEvent.click(screen.getByTestId('kobo-advanced-trigger'));
    expect(screen.getByText('Exclude Fields')).toBeInTheDocument();
  });
});
