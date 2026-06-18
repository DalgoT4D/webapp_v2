import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { Calendar } from './calendar';

const meta = {
  title: 'UI/Calendar',
  component: Calendar,
  tags: ['autodocs'],
} satisfies Meta<typeof Calendar>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single-date selection (the default mode) — state is held by a small wrapper. */
export const Single: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <div data-testid="calendar-single">
        <Calendar mode="single" selected={date} onSelect={setDate} />
      </div>
    );
  },
};

/** Date-range selection. */
export const Range: Story = {
  render: () => {
    const today = new Date();
    const [range, setRange] = useState<{ from?: Date; to?: Date } | undefined>({
      from: today,
      to: new Date(today.getFullYear(), today.getMonth(), today.getDate() + 5),
    });
    return (
      <div data-testid="calendar-range">
        <Calendar mode="range" selected={range} onSelect={setRange} numberOfMonths={2} />
      </div>
    );
  },
};

/** Dropdown caption layout for quick month/year navigation. */
export const WithDropdownCaption: Story = {
  render: () => {
    const [date, setDate] = useState<Date | undefined>(new Date());
    return (
      <div data-testid="calendar-dropdown">
        <Calendar mode="single" selected={date} onSelect={setDate} captionLayout="dropdown" />
      </div>
    );
  },
};
