import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldValues } from 'react-hook-form';
import { StartTimeField } from '../StartTimeField';
import type { FieldNode } from '@/components/connectors/types';

const field: FieldNode = {
  type: 'basic',
  path: ['start_time'],
  title: 'Start Time',
  required: false,
  hidden: false,
  fieldType: 'string',
  default: '2023-03-15T00:00:00',
};

function Harness({ onValue }: { onValue: (v: unknown) => void }) {
  const { control, setValue, watch } = useForm<FieldValues>({
    defaultValues: { start_time: '2023-03-15T00:00:00' },
  });
  onValue(watch('start_time'));
  return <StartTimeField field={field} control={control} setValue={setValue} />;
}

describe('StartTimeField', () => {
  it('shows the current start_time as a formatted date on the trigger', () => {
    render(<Harness onValue={() => {}} />);
    expect(screen.getByTestId('start-time-trigger')).toHaveTextContent('Mar 15th, 2023');
  });

  it('serializes a picked day to YYYY-MM-DDT00:00:00', async () => {
    let latest: unknown;
    render(<Harness onValue={(v) => (latest = v)} />);
    // Open the popover via the DatePicker trigger button (shows the current date).
    await userEvent.click(screen.getByRole('button', { name: /Mar 15th, 2023/i }));
    // react-day-picker day cells are buttons whose textContent is the day number.
    const day20 = screen.getAllByRole('button').find((b) => b.textContent === '20');
    expect(day20).toBeDefined();
    await userEvent.click(day20!);
    expect(latest).toBe('2023-03-20T00:00:00');
  });
});
