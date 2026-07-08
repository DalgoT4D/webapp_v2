import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './dialog';
import { Button } from './button';

const meta = {
  title: 'UI/Dialog',
  component: Dialog,
  tags: ['autodocs'],
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Renders open in the docs canvas so the content is visible. */
export const Open: Story = {
  render: () => (
    <Dialog defaultOpen data-testid="dialog-open">
      <DialogContent data-testid="dialog-open-content">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="cancel" data-testid="dialog-open-cancel">
            Cancel
          </Button>
          <Button variant="primary" data-testid="dialog-open-confirm">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

/** Closed by default — click the trigger to open. */
export const Interactive: Story = {
  render: () => (
    <Dialog data-testid="dialog-interactive">
      <DialogTrigger asChild>
        <Button data-testid="dialog-interactive-trigger">Open dialog</Button>
      </DialogTrigger>
      <DialogContent data-testid="dialog-interactive-content">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you&apos;re done.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="cancel" data-testid="dialog-interactive-cancel">
            Cancel
          </Button>
          <Button variant="primary" data-testid="dialog-interactive-confirm">
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
