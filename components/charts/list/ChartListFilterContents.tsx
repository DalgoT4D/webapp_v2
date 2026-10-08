'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionCheckboxRow } from '@/components/list-page/OptionCheckboxRow';
import { filterOptionsBySearch, toggleValue } from '@/components/list-page/list-logic';
import type { ChartNameFilters } from './chart-list-logic';

interface ChartNameFilterContentProps {
  nameFilters: ChartNameFilters;
  setNameFilters: Dispatch<SetStateAction<ChartNameFilters>>;
}

export function ChartNameFilterContent({
  nameFilters,
  setNameFilters,
}: ChartNameFilterContentProps) {
  return (
    <>
      <div className="space-y-2">
        <Input
          placeholder="Search chart names..."
          data-testid="chart-list-filter-name-input"
          value={nameFilters.text}
          onChange={(e) => setNameFilters((prev) => ({ ...prev, text: e.target.value }))}
          className="h-8"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="favorites"
            data-testid="chart-list-filter-favorites-checkbox"
            checked={nameFilters.showFavorites}
            onCheckedChange={(checked) =>
              setNameFilters((prev) => ({ ...prev, showFavorites: checked as boolean }))
            }
          />
          <Label htmlFor="favorites" className="text-sm cursor-pointer">
            Show only favorites
          </Label>
        </div>
      </div>
    </>
  );
}

interface ChartDataSourceFilterContentProps {
  options: string[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  search: string;
  onSearchChange: (search: string) => void;
}

export function ChartDataSourceFilterContent({
  options,
  selected,
  setSelected,
  search,
  onSearchChange,
}: ChartDataSourceFilterContentProps) {
  const visibleOptions = filterOptionsBySearch(options, search);
  return (
    <>
      <div className="space-y-2">
        <Input
          placeholder="Search data sources..."
          data-testid="chart-list-filter-source-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2">
        {visibleOptions.length > 0 ? (
          visibleOptions.map((dataSource) => (
            <OptionCheckboxRow
              key={dataSource}
              label={dataSource}
              isChecked={selected.includes(dataSource)}
              onToggle={() => setSelected((prev) => toggleValue(prev, dataSource))}
              testId={`chart-list-filter-source-option-${dataSource}`}
              checkboxTestId={`chart-list-filter-source-checkbox-${dataSource}`}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No data sources found</p>
        )}
      </div>
    </>
  );
}

interface ChartTypeFilterContentProps {
  options: string[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
}

export function ChartTypeFilterContent({
  options,
  selected,
  setSelected,
}: ChartTypeFilterContentProps) {
  return (
    <div className="space-y-2">
      {options.map((chartType) => (
        <OptionCheckboxRow
          key={chartType}
          label={chartType}
          isChecked={selected.includes(chartType)}
          onToggle={() => setSelected((prev) => toggleValue(prev, chartType))}
          testId={`chart-list-filter-type-option-${chartType}`}
          checkboxTestId={`chart-list-filter-type-checkbox-${chartType}`}
          isCapitalized
        />
      ))}
    </div>
  );
}
