'use client';

import { BarChart2, PieChart, LineChart } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

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
];

export function ChartTypeSelector({ value, onChange }: ChartTypeSelectorProps) {
  return (
    <RadioGroup value={value} onValueChange={onChange}>
      <div className="grid grid-cols-3 gap-4">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          return (
            <Label key={type.id} htmlFor={type.id} className="cursor-pointer">
              <Card
                className={`p-4 hover:border-primary transition-colors ${value === type.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <RadioGroupItem value={type.id} id={type.id} className="sr-only" />
                <div className="flex flex-col items-center text-center space-y-2">
                  <Icon className="h-8 w-8" />
                  <div>
                    <p className="font-medium">{type.name}</p>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </div>
                </div>
              </Card>
            </Label>
          );
        })}
      </div>
    </RadioGroup>
  );
}
