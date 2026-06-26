import type { Meta, StoryObj } from '@storybook/nextjs';
import { Slider } from './slider';
import { Label } from './label';

const meta = {
  title: 'UI/Slider',
  component: Slider,
  tags: ['autodocs'],
  argTypes: {
    min: { control: 'number' },
    max: { control: 'number' },
    step: { control: 'number' },
    disabled: { control: 'boolean' },
  },
  args: { min: 0, max: 100, step: 1, disabled: false },
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} defaultValue={[50]} data-testid="slider-default" />
    </div>
  ),
};

/** Two thumbs define a range (value is a 2-element array). */
export const Range: Story = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} value={[25, 75]} data-testid="slider-range" />
    </div>
  ),
};

export const Stepped: Story = {
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} step={10} defaultValue={[40]} data-testid="slider-stepped" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <div style={{ width: 280 }}>
      <Slider {...args} defaultValue={[30]} data-testid="slider-disabled" />
    </div>
  ),
};

/** Slider paired with a Label. */
export const WithLabel: Story = {
  render: (args) => (
    <div style={{ display: 'grid', gap: 12, width: 280 }}>
      <Label htmlFor="volume-slider">Volume</Label>
      <Slider {...args} defaultValue={[60]} data-testid="slider-with-label" />
    </div>
  ),
};
