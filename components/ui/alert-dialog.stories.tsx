import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from './alert-dialog';
import { Button } from './button';

const meta = {
  title: 'UI/AlertDialog',
  component: AlertDialog,
  tags: ['autodocs'],
} satisfies Meta<typeof AlertDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

/** Destructive confirm pattern, rendered open so the content is visible. */
export const Open: Story = {
  render: () => (
    <AlertDialog defaultOpen data-testid="alert-dialog-open">
      <AlertDialogContent data-testid="alert-dialog-open-content">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your
            data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="alert-dialog-open-cancel">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:opacity-90"
            data-testid="alert-dialog-open-confirm"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};

/** Closed by default — click the trigger to open the destructive confirm. */
export const Interactive: Story = {
  render: () => (
    <AlertDialog data-testid="alert-dialog-interactive">
      <AlertDialogTrigger asChild>
        <Button variant="destructive" data-testid="alert-dialog-interactive-trigger">
          Delete account
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent data-testid="alert-dialog-interactive-content">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your account and remove your
            data from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid="alert-dialog-interactive-cancel">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:opacity-90"
            data-testid="alert-dialog-interactive-confirm"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  ),
};
