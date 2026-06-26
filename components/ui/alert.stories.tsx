import type { Meta, StoryObj } from '@storybook/nextjs';
import { Alert, AlertTitle, AlertDescription } from './alert';

const VARIANTS = ['default', 'destructive', 'warning', 'info', 'success'] as const;

const meta = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'select', options: VARIANTS },
  },
  args: { variant: 'default' },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => (
    <Alert {...args} data-testid="alert-default">
      <AlertTitle>Heads up!</AlertTitle>
      <AlertDescription>You can add components to your app using the CLI.</AlertDescription>
    </Alert>
  ),
};

export const Destructive: Story = {
  args: { variant: 'destructive' },
  render: (args) => (
    <Alert {...args} data-testid="alert-destructive">
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>Your session has expired. Please log in again.</AlertDescription>
    </Alert>
  ),
};

export const Warning: Story = {
  args: { variant: 'warning' },
  render: (args) => (
    <Alert {...args} data-testid="alert-warning">
      <AlertTitle>Warning</AlertTitle>
      <AlertDescription>This action cannot be undone.</AlertDescription>
    </Alert>
  ),
};

export const Info: Story = {
  args: { variant: 'info' },
  render: (args) => (
    <Alert {...args} data-testid="alert-info">
      <AlertTitle>Did you know?</AlertTitle>
      <AlertDescription>Pipelines can be scheduled to run automatically.</AlertDescription>
    </Alert>
  ),
};

export const Success: Story = {
  args: { variant: 'success' },
  render: (args) => (
    <Alert {...args} data-testid="alert-success">
      <AlertTitle>Success</AlertTitle>
      <AlertDescription>Your changes have been saved.</AlertDescription>
    </Alert>
  ),
};

/** Every variant rendered together — the canonical reference grid. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', maxWidth: 480 }}>
      {VARIANTS.map((variant) => (
        <Alert key={variant} variant={variant} data-testid={`alert-${variant}`}>
          <AlertTitle>{variant}</AlertTitle>
          <AlertDescription>This is a {variant} alert message.</AlertDescription>
        </Alert>
      ))}
    </div>
  ),
};
