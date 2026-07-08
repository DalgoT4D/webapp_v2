import type { Meta, StoryObj } from '@storybook/nextjs';
import { Input } from './input';
import { Label } from './label';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['text', 'email', 'password', 'number', 'search', 'tel', 'url'],
    },
    placeholder: { control: 'text' },
    disabled: { control: 'boolean' },
    value: { control: 'text' },
  },
  args: { type: 'text', placeholder: 'Enter text…', disabled: false },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { 'data-testid': 'input-default' } as Story['args'],
};

export const WithPlaceholder: Story = {
  args: { placeholder: 'you@example.com', 'data-testid': 'input-placeholder' } as Story['args'],
};

export const WithValue: Story = {
  args: { defaultValue: 'Prefilled value', 'data-testid': 'input-value' } as Story['args'],
};

export const Disabled: Story = {
  args: {
    disabled: true,
    defaultValue: 'Disabled',
    'data-testid': 'input-disabled',
  } as Story['args'],
};

export const Email: Story = {
  args: {
    type: 'email',
    placeholder: 'you@example.com',
    'data-testid': 'input-email',
  } as Story['args'],
};

export const Password: Story = {
  args: {
    type: 'password',
    placeholder: '••••••••',
    'data-testid': 'input-password',
  } as Story['args'],
};

/** Input paired with a Label via htmlFor/id. */
export const WithLabel: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 8, maxWidth: 280 }}>
      <Label htmlFor="email-field">Email address</Label>
      <Input
        id="email-field"
        type="email"
        placeholder="you@example.com"
        data-testid="input-with-label"
      />
    </div>
  ),
};
