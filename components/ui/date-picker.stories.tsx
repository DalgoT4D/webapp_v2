import type { Meta, StoryObj } from '@storybook/nextjs';
import { useState } from 'react';
import { DatePicker } from './date-picker';

// DatePicker is fully controlled: it owns neither its popover nor its calendar
// state. The wrapper holds `value` (committed date), `selected` (staged calendar
// date), and `open` (popover) — mirroring how the app drives it.
function DatePickerDemo({ initialValue, disabled }: { initialValue?: Date; disabled?: boolean }) {
  const [value, setValue] = useState<Date | undefined>(initialValue);
  const [selected, setSelected] = useState<Date | undefined>(initialValue);
  const [open, setOpen] = useState(false);

  return (
    <div style={{ width: 280 }} data-testid="date-picker-demo">
      <DatePicker
        value={value}
        selected={selected}
        open={open}
        disabled={disabled}
        onOpenChange={setOpen}
        onSelect={(date) => {
          setSelected(date);
          setValue(date);
        }}
      />
    </div>
  );
}

const meta = {
  title: 'UI/DatePicker',
  component: DatePicker,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DatePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state — shows the placeholder. Click the trigger to open the calendar. */
export const Default: Story = {
  render: () => <DatePickerDemo />,
};

/** Pre-filled with a committed date, formatted as "MMM do, yyyy". */
export const Prefilled: Story = {
  render: () => <DatePickerDemo initialValue={new Date(2026, 5, 18)} />,
};

/** Disabled trigger — cannot be opened. */
export const Disabled: Story = {
  render: () => <DatePickerDemo disabled />,
};
