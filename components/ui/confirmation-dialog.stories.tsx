import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { ConfirmationDialog } from './confirmation-dialog';
import { Button } from './button';

const meta = {
  title: 'UI/ConfirmationDialog',
  component: ConfirmationDialog,
  tags: ['autodocs'],
} satisfies Meta<typeof ConfirmationDialog>;

export default meta;
type Story = StoryObj<typeof meta>;

type DialogType = 'warning' | 'info' | 'success' | 'error';

// Stateful wrapper — ConfirmationDialog is controlled (open + onOpenChange), so the
// story owns the open state and renders a trigger Button. `type` drives the icon and
// the confirm button variant (warning/error → destructive).
function ConfirmationDialogDemo({
  defaultOpen = false,
  type = 'warning',
  title,
  description,
  confirmText,
  triggerLabel,
}: {
  defaultOpen?: boolean;
  type?: DialogType;
  title: string;
  description: string;
  confirmText?: string;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <>
      <Button
        variant={type === 'warning' || type === 'error' ? 'destructive' : 'default'}
        data-testid="confirmation-dialog-trigger"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>
      <ConfirmationDialog
        open={open}
        onOpenChange={setOpen}
        type={type}
        title={title}
        description={description}
        confirmText={confirmText}
        onConfirm={() => {
          /* confirm action */
        }}
        onCancel={() => {
          /* cancel action */
        }}
      />
    </>
  );
}

/** Destructive delete confirmation (`type="warning"` → red confirm button). */
export const DeleteConfirmation: Story = {
  render: () => (
    <ConfirmationDialogDemo
      type="warning"
      triggerLabel="Delete chart"
      title="Delete chart?"
      description="This will permanently delete the chart. This action cannot be undone."
      confirmText="Delete"
    />
  ),
};

/** Opens immediately in the docs canvas so the dialog is visible. */
export const Open: Story = {
  render: () => (
    <ConfirmationDialogDemo
      defaultOpen
      type="warning"
      triggerLabel="Delete chart"
      title="Delete chart?"
      description="This will permanently delete the chart. This action cannot be undone."
      confirmText="Delete"
    />
  ),
};

/** Informational confirmation — neutral (`default`) confirm button. */
export const Info: Story = {
  render: () => (
    <ConfirmationDialogDemo
      type="info"
      triggerLabel="Publish report"
      title="Publish this report?"
      description="The report will be shared with everyone in your organization."
      confirmText="Publish"
    />
  ),
};
