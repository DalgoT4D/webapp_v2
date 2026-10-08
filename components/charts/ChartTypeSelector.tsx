'use client';

import { Button } from '@/components/ui/button';
import {
  BUILDER_SELECTOR_ORDER,
  CHART_TYPE_INFO,
  getChartTypeColors,
} from '@/components/charts/chart-types/registry';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';

interface ChartTypeSelectorProps {
  value?: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const chartTypes = BUILDER_SELECTOR_ORDER.map((type) => ({
  id: type,
  name: CHART_TYPE_INFO[type].selector.label,
  description: CHART_TYPE_INFO[type].selector.description,
  icon: CHART_TYPE_INFO[type].icon,
}));

export function ChartTypeSelector({ value, onChange, disabled = false }: ChartTypeSelectorProps) {
  const selectedType = value || 'bar';

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">Chart Type</h3>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {chartTypes.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;
          const typeColors = getChartTypeColors(type.id);

          return (
            <Button
              key={type.id}
              variant="outline"
              className={`aspect-square p-3 flex items-center justify-center transition-all ${
                isSelected ? 'shadow-sm' : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
              style={
                isSelected
                  ? {
                      backgroundColor: typeColors.bgColor,
                      borderColor: typeColors.color,
                      color: typeColors.color,
                    }
                  : undefined
              }
              onClick={() => {
                // Fire only on an actual switch (skip re-clicking the current type).
                if (type.id !== selectedType) {
                  trackEvent(ANALYTICS_EVENTS.CHART_TYPE_SELECTED, { chart_type: type.id });
                }
                onChange(type.id);
              }}
              disabled={disabled}
              title={type.name}
              data-testid={`chart-type-switch-${type.id}`}
            >
              <Icon
                className="w-6 h-6"
                style={{ color: isSelected ? typeColors.color : '#6B7280' }}
              />
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
