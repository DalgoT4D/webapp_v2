import type { Meta, StoryObj } from '@storybook/nextjs';
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
} from './table';

interface ChartRow {
  id: number;
  name: string;
  type: string;
  updated: string;
  status: string;
}

const CHARTS: ChartRow[] = [
  { id: 1, name: 'Monthly Revenue', type: 'Bar', updated: '2026-06-12', status: 'Published' },
  { id: 2, name: 'Beneficiaries by Region', type: 'Map', updated: '2026-06-10', status: 'Draft' },
  { id: 3, name: 'Program Outcomes', type: 'Line', updated: '2026-06-08', status: 'Published' },
  { id: 4, name: 'Survey Completion', type: 'Pie', updated: '2026-06-05', status: 'Archived' },
  { id: 5, name: 'Funding Sources', type: 'Number', updated: '2026-06-01', status: 'Published' },
];

const meta = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

/** A realistic list of charts. */
export const Default: Story = {
  render: () => (
    <Table data-testid="table-default">
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Last updated</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {CHARTS.map((chart) => (
          <TableRow key={chart.id} data-testid={`table-row-${chart.id}`}>
            <TableCell className="font-medium">{chart.name}</TableCell>
            <TableCell>{chart.type}</TableCell>
            <TableCell>{chart.updated}</TableCell>
            <TableCell className="text-right">{chart.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};

/** Same data with a caption and a summary footer row. */
export const WithCaption: Story = {
  render: () => (
    <Table data-testid="table-with-caption">
      <TableCaption>A list of your organization's charts.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Last updated</TableHead>
          <TableHead className="text-right">Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {CHARTS.map((chart) => (
          <TableRow key={chart.id} data-testid={`table-caption-row-${chart.id}`}>
            <TableCell className="font-medium">{chart.name}</TableCell>
            <TableCell>{chart.type}</TableCell>
            <TableCell>{chart.updated}</TableCell>
            <TableCell className="text-right">{chart.status}</TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={3}>Total charts</TableCell>
          <TableCell className="text-right">{CHARTS.length}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  ),
};
