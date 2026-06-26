import type { Meta, StoryObj } from '@storybook/nextjs';
import { Skeleton } from './skeleton';

const meta = {
  title: 'UI/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
} satisfies Meta<typeof Skeleton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <Skeleton className="h-4 w-48" data-testid="skeleton-default" />,
};

export const Circle: Story = {
  render: () => <Skeleton className="size-12 rounded-full" data-testid="skeleton-circle" />,
};

/** A realistic loading placeholder composing several skeletons. */
export const CardPlaceholder: Story = {
  render: () => (
    <div
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: 320 }}
      data-testid="skeleton-card-placeholder"
    >
      <Skeleton className="size-12 rounded-full" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
      </div>
    </div>
  ),
};
