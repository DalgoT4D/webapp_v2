'use client';

import { BarChart2, LineChart, Table, PieChart } from 'lucide-react';
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

      <div className="grid grid-cols-4 gap-3">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;

          return (
            <Button
              key={type.id}
              variant="outline"
              className={`h-auto p-4 flex flex-col items-center space-y-2 transition-all ${
                isSelected
                  ? 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100 shadow-sm'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
              onClick={() => onChange(type.id)}
              disabled={disabled}
            >
              <Icon className={`w-6 h-6 ${isSelected ? 'text-blue-600' : 'text-gray-600'}`} />
              <div className="text-center">
                <div
                  className={`text-xs font-medium leading-tight ${
                    isSelected ? 'text-blue-900' : 'text-gray-900'
                  }`}
                >
                  {type.name}
                </div>
              </div>
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
