import type { Meta, StoryObj } from '@storybook/nextjs';
import { Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';
import { ToggleGroup, ToggleGroupItem } from './toggle-group';

const VARIANTS = ['default', 'outline'] as const;
const SIZES = ['default', 'sm', 'lg'] as const;

const meta = {
  title: 'UI/ToggleGroup',
  component: ToggleGroup,
  tags: ['autodocs'],
  argTypes: {
    type: { control: 'inline-radio', options: ['single', 'multiple'] },
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'select', options: SIZES },
    disabled: { control: 'boolean' },
  },
} satisfies Meta<typeof ToggleGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Single selection — only one alignment can be active at a time. */
export const Single: Story = {
  args: { type: 'single', variant: 'outline', defaultValue: 'left' },
  render: (args) => (
    <ToggleGroup {...args} data-testid="toggle-group-single">
      <ToggleGroupItem value="left" aria-label="Align left">
        <AlignLeft className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="center" aria-label="Align center">
        <AlignCenter className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="right" aria-label="Align right">
        <AlignRight className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

/** Multiple selection — any combination of formatting toggles can be active. */
export const Multiple: Story = {
  args: { type: 'multiple', variant: 'outline', defaultValue: ['bold'] },
  render: (args) => (
    <ToggleGroup {...args} data-testid="toggle-group-multiple">
      <ToggleGroupItem value="bold" aria-label="Bold">
        <Bold className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic">
        <Italic className="size-4" />
      </ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline">
        <Underline className="size-4" />
      </ToggleGroupItem>
    </ToggleGroup>
  ),
};

/** Text-labelled items rather than icons. */
export const WithText: Story = {
  args: { type: 'single', variant: 'outline', defaultValue: 'day' },
  render: (args) => (
    <ToggleGroup {...args} data-testid="toggle-group-text">
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month">Month</ToggleGroupItem>
    </ToggleGroup>
  ),
};

/** Every size rendered together for comparison. */
export const AllSizes: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {SIZES.map((size) => (
        <ToggleGroup
          key={size}
          type="single"
          variant="outline"
          size={size}
          defaultValue="left"
          data-testid={`toggle-group-size-${size}`}
        >
          <ToggleGroupItem value="left" aria-label="Align left">
            <AlignLeft className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center">
            <AlignCenter className="size-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right">
            <AlignRight className="size-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      ))}
    </div>
  ),
};
