import type { Meta, StoryObj } from '@storybook/nextjs';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

const meta = {
  title: 'UI/RadioGroup',
  component: RadioGroup,
  tags: ['autodocs'],
  argTypes: {
    defaultValue: { control: 'text' },
    disabled: { control: 'boolean' },
  },
  args: { defaultValue: 'comfortable', disabled: false },
} satisfies Meta<typeof RadioGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Three options, each with its own associated Label. */
export const Default: Story = {
  render: (args) => (
    <RadioGroup {...args} data-testid="radio-group-default">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="default" id="r-default" data-testid="radio-default" />
        <Label htmlFor="r-default">Default</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="comfortable" id="r-comfortable" data-testid="radio-comfortable" />
        <Label htmlFor="r-comfortable">Comfortable</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="compact" id="r-compact" data-testid="radio-compact" />
        <Label htmlFor="r-compact">Compact</Label>
      </div>
    </RadioGroup>
  ),
};

/** Entire group disabled. */
export const Disabled: Story = {
  args: { disabled: true },
  render: (args) => (
    <RadioGroup {...args} data-testid="radio-group-disabled">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="comfortable" id="rd-comfortable" data-testid="radio-disabled-1" />
        <Label htmlFor="rd-comfortable">Comfortable</Label>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <RadioGroupItem value="compact" id="rd-compact" data-testid="radio-disabled-2" />
        <Label htmlFor="rd-compact">Compact</Label>
      </div>
    </RadioGroup>
  ),
};
