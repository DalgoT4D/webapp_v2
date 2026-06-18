import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
} from './card';
import { Button } from './button';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Card style={{ width: 360 }} data-testid="card-default">
      <CardHeader>
        <CardTitle>Sales overview</CardTitle>
        <CardDescription>Revenue across all regions this quarter.</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Your data is up to date as of the last pipeline run.
        </p>
      </CardContent>
      <CardFooter>
        <Button variant="primary" data-testid="card-footer-action">
          View details
        </Button>
      </CardFooter>
    </Card>
  ),
};

export const WithAction: Story = {
  render: () => (
    <Card style={{ width: 360 }} data-testid="card-with-action">
      <CardHeader>
        <CardTitle>Pipeline status</CardTitle>
        <CardDescription>Last run completed successfully.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" data-testid="card-action-btn">
            Refresh
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Next scheduled run in 2 hours.</p>
      </CardContent>
    </Card>
  ),
};

export const ContentOnly: Story = {
  render: () => (
    <Card style={{ width: 360 }} data-testid="card-content-only">
      <CardContent>
        <p className="text-sm">A minimal card with only content and no header or footer.</p>
      </CardContent>
    </Card>
  ),
};
