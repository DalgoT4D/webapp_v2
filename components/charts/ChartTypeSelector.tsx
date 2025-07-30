'use client';

import { BarChart2, PieChart, LineChart, Hash, Map } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';

interface ChartTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
}

const chartTypes = [
  {
    id: 'bar',
    name: 'Bar',
    description: 'Compare values across categories',
    icon: BarChart2,
  },
  {
    id: 'pie',
    name: 'Pie',
    description: 'Show proportions of a whole',
    icon: PieChart,
  },
  {
    id: 'line',
    name: 'Line',
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
];

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <div className="space-y-3">
      <Tabs value={value || 'bar'} onValueChange={onChange}>
        <TabsList className="grid w-full grid-cols-5">
          {chartTypes.map((type) => {
            const Icon = type.icon;
            return (
              <TabsTrigger key={type.id} value={type.id} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span>{type.name}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
      </Tabs>

      {/* Show description for selected chart type */}
      <p className="text-sm text-muted-foreground">
        {chartTypes.find((t) => t.id === (value || 'bar'))?.description}
      </p>
    </div>
  );
}
