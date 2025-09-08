'use client';

import { BarChart2, LineChart, Table, PieChart, Hash, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ChartTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const chartTypes = [
  {
    id: 'bar',
    name: 'Bar Chart',
    description: 'Compare values across categories',
    icon: BarChart2,
  },
  {
    id: 'line',
    name: 'Line Chart',
    description: 'Display trends over time',
    icon: LineChart,
  },
  {
    id: 'pie',
    name: 'Pie Chart',
    description: 'Show proportions of a whole',
    icon: PieChart,
  },
  {
    id: 'number',
    name: 'Big Number',
    description: 'Display a single key metric prominently',
    icon: Hash,
  },
  {
    id: 'map',
    name: 'Map',
    description: 'Visualize geographic data',
    icon: MapPin,
  },
  {
    id: 'table',
    name: 'Table',
    description: 'Display data in rows and columns',
    icon: Table,
  },
];

export function ChartTypeSelector({ value, onChange, disabled = false }: ChartTypeSelectorProps) {
  const selectedType = value || 'bar';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">Chart Type</h3>
        <p className="text-xs text-gray-500">Choose how to visualize your data</p>
      </div>

      <div className="grid grid-cols-6 gap-3">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <Button
              key={type.id}
              variant="outline"
              className={`aspect-square p-3 flex items-center justify-center transition-all ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 shadow-sm'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
              onClick={() => onChange(type.id)}
              disabled={disabled}
              title={type.name}
            >
              <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
            </Button>
          );
        })}
      </div>

      {/* Show description for selected chart type */}
      <p className="text-sm text-gray-500 text-center">
        {chartTypes.find((t) => t.id === selectedType)?.description}
      </p>
    </div>
  );
}
