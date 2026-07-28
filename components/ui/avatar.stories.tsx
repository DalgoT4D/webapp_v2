import type { Meta, StoryObj } from '@storybook/nextjs';
import { Avatar, AvatarImage, AvatarFallback } from './avatar';

const meta = {
  title: 'UI/Avatar',
  component: Avatar,
  tags: ['autodocs'],
} satisfies Meta<typeof Avatar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Avatar data-testid="avatar-default">
      <AvatarImage src="https://i.pravatar.cc/64" alt="User avatar" />
      <AvatarFallback>DG</AvatarFallback>
    </Avatar>
  ),
};

/** When the image fails or is missing, the fallback initials show. */
export const Fallback: Story = {
  render: () => (
    <Avatar data-testid="avatar-fallback">
      <AvatarImage src="" alt="User avatar" />
      <AvatarFallback>DG</AvatarFallback>
    </Avatar>
  ),
};

/** Avatars at different sizes via Tailwind size utilities. */
export const AllVariants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Avatar className="size-6" data-testid="avatar-sm">
        <AvatarImage src="https://i.pravatar.cc/64" alt="Small avatar" />
        <AvatarFallback>DG</AvatarFallback>
      </Avatar>
      <Avatar data-testid="avatar-default">
        <AvatarImage src="https://i.pravatar.cc/64" alt="Default avatar" />
        <AvatarFallback>DG</AvatarFallback>
      </Avatar>
      <Avatar className="size-12" data-testid="avatar-lg">
        <AvatarImage src="https://i.pravatar.cc/64" alt="Large avatar" />
        <AvatarFallback>DG</AvatarFallback>
      </Avatar>
      <Avatar className="size-12" data-testid="avatar-fallback-only">
        <AvatarImage src="" alt="Fallback avatar" />
        <AvatarFallback>DG</AvatarFallback>
      </Avatar>
    </div>
  ),
};
