import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Button } from './button';
import { toastSuccess, toastError, toastInfo, toastPromise } from '@/lib/toast';

// Toasts are fired imperatively via lib/toast.ts (wrapping sonner). The <Toaster>
// host is mounted globally in .storybook/preview.tsx, mirroring the real app.
const meta = {
  title: 'UI/Toast',
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Click to fire each toast type. They appear top-center, like in the app. */
export const Variants: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <Button
        variant="primary"
        data-testid="toast-success"
        onClick={() => toastSuccess.created('Chart')}
      >
        Success
      </Button>
      <Button
        variant="destructive"
        data-testid="toast-error"
        onClick={() => toastError.api('Something went wrong. Please try again.')}
      >
        Error
      </Button>
      <Button variant="outline" data-testid="toast-info" onClick={() => toastInfo.autoSaved()}>
        Info
      </Button>
      <Button
        variant="secondary"
        data-testid="toast-promise"
        onClick={() =>
          toastPromise.save(new Promise((resolve) => setTimeout(resolve, 1500)), 'Dashboard')
        }
      >
        Promise (loading → success)
      </Button>
    </div>
  ),
};
