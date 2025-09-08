'use client';

import { BarChart2, PieChart, LineChart, Hash, Map, Table } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChartTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
}

const chartTypes = [
  {
    id: 'bar',
    name: 'Bar Chart',
    description: 'Compare values across categories',
    icon: BarChart2,
  },
  {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: PieChart,
  },
  {
    id: 'line',
    name: 'Line Chart',
    description: 'Display trends over time',
    icon: LineChart,
  },
  {
    id: 'number',
    name: 'Number',
    description: 'Display a single metric or KPI',
    icon: Hash,
  },
  {
    id: 'map',
    name: 'Map',
    description: 'Visualize geographic data',
    icon: Map,
  },
  {
    id: 'table',
    name: 'Table',
    description: 'Display data in rows and columns',
    icon: Table,
  },
];

export function ChartTypeSelectorDropdown({ value, onChange }: ChartTypeSelectorProps) {
  const selectedChart = chartTypes.find((t) => t.id === value);

  return (
    <div className="space-y-2">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue>
            {selectedChart ? (
              <div className="flex items-center gap-2">
                <selectedChart.icon className="h-4 w-4" />
                <span>{selectedChart.name}</span>
              </div>
            ) : (
              'Select a chart type'
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {chartTypes.map((type) => {
            const Icon = type.icon;
            return (
              <SelectItem key={type.id} value={type.id}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4" />
                  <span>{type.name}</span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {/* Show description for selected chart type */}
      {selectedChart && (
        <p className="text-sm text-muted-foreground">{selectedChart.description}</p>
      )}
    </div>
  );
}
