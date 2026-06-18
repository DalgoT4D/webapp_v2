import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { TimePicker } from './time-picker';

// TimePicker is controlled via value/onChange. The value is always an "HH:MM"
// string in 24-hour format; the popover state is internal to the component.
function TimePickerDemo({
  initialValue = '',
  format,
  disabled,
}: {
  initialValue?: string;
  format?: '12h' | '24h';
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <div data-testid="time-picker-demo">
      <TimePicker
        value={value}
        onChange={setValue}
        format={format}
        disabled={disabled}
        data-testid="time-picker"
      />
    </div>
  );
}

const meta = {
  title: 'UI/TimePicker',
  component: TimePicker,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TimePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Empty state — shows the placeholder ("HH:MM AM" in the default 12h format). */
export const Default: Story = {
  render: () => <TimePickerDemo />,
};

/** Pre-filled with 14:30, rendered in 12-hour format ("02:30 PM"). */
export const Prefilled: Story = {
  render: () => <TimePickerDemo initialValue="14:30" />,
};

/** 24-hour display format. Internal storage is always 24h regardless. */
export const TwentyFourHour: Story = {
  render: () => <TimePickerDemo initialValue="09:05" format="24h" />,
};

/** Disabled trigger — cannot be opened. */
export const Disabled: Story = {
  render: () => <TimePickerDemo initialValue="08:00" disabled />,
};
