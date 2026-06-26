import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { DurationPicker } from './duration-picker';

// DurationPicker is a controlled date-range picker: it takes dateFrom/dateTo and
// commits a new range via onApply (OK button). The wrapper holds the committed
// range; the component stages edits internally until OK is pressed.
function DurationPickerDemo({ initialFrom, initialTo }: { initialFrom?: Date; initialTo?: Date }) {
  const [dateFrom, setDateFrom] = useState<Date | undefined>(initialFrom);
  const [dateTo, setDateTo] = useState<Date | undefined>(initialTo);

  return (
    <div data-testid="duration-picker-demo">
      <DurationPicker
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={(from, to) => {
          setDateFrom(from);
          setDateTo(to);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'UI/DurationPicker',
  component: DurationPicker,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DurationPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state — trigger reads "Select duration". Pick a start then an end date. */
export const Default: Story = {
  render: () => <DurationPickerDemo />,
};

/** Pre-filled with a committed date range. */
export const Prefilled: Story = {
  render: () => (
    <DurationPickerDemo initialFrom={new Date(2026, 5, 1)} initialTo={new Date(2026, 5, 18)} />
  ),
};
