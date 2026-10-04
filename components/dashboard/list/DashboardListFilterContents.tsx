'use client';

import type { Dispatch, SetStateAction } from 'react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { OptionCheckboxRow } from '@/components/list-page/OptionCheckboxRow';
import { filterOptionsBySearch, toggleValue } from '@/components/list-page/list-logic';
import type { DashboardNameFilters } from './dashboard-list-logic';

type NameFlag = 'showFavorites' | 'showLocked' | 'showShared';

const NAME_FLAG_OPTIONS: { flag: NameFlag; id: string; testId: string; label: string }[] = [
  {
    flag: 'showFavorites',
    id: 'favorites',
    testId: 'dashboard-list-name-filter-favorites',
    label: 'Show only favorites',
  },
  {
    flag: 'showLocked',
    id: 'locked',
    testId: 'dashboard-list-name-filter-locked',
    label: 'Show only locked',
  },
  // PINNED-BUGS: "Show only shared" list filter always empty — list API lacks `is_public`
  {
    flag: 'showShared',
    id: 'shared',
    testId: 'dashboard-list-name-filter-shared',
    label: 'Show only shared',
  },
];

interface DashboardNameFilterContentProps {
  nameFilters: DashboardNameFilters;
  setNameFilters: Dispatch<SetStateAction<DashboardNameFilters>>;
}

export function DashboardNameFilterContent({
  nameFilters,
  setNameFilters,
}: DashboardNameFilterContentProps) {
  return (
    <>
      <div className="space-y-2">
        <Input
          placeholder="Search dashboard names..."
          data-testid="dashboard-list-name-filter-search"
          value={nameFilters.text}
          onChange={(e) => setNameFilters((prev) => ({ ...prev, text: e.target.value }))}
          className="h-8"
        />
      </div>

      <div className="space-y-3">
        {NAME_FLAG_OPTIONS.map((option) => (
          <div key={option.flag} className="flex items-center space-x-2">
            <Checkbox
              id={option.id}
              data-testid={option.testId}
              checked={nameFilters[option.flag]}
              onCheckedChange={(checked) =>
                setNameFilters((prev) => ({ ...prev, [option.flag]: checked as boolean }))
              }
            />
            <Label htmlFor={option.id} className="text-sm cursor-pointer">
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </>
  );
}

interface DashboardOwnerFilterContentProps {
  options: string[];
  selected: string[];
  setSelected: Dispatch<SetStateAction<string[]>>;
  search: string;
  onSearchChange: (search: string) => void;
}

export function DashboardOwnerFilterContent({
  options,
  selected,
  setSelected,
  search,
  onSearchChange,
}: DashboardOwnerFilterContentProps) {
  const visibleOwners = filterOptionsBySearch(options, search);
  return (
    <>
      <div className="space-y-2">
        <Input
          placeholder="Search owners..."
          data-testid="dashboard-list-owner-filter-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8"
        />
      </div>

      <div className="max-h-48 overflow-y-auto space-y-2">
        {visibleOwners.length > 0 ? (
          visibleOwners.map((owner) => (
            <OptionCheckboxRow
              key={owner}
              label={owner}
              isChecked={selected.includes(owner)}
              onToggle={() => setSelected((prev) => toggleValue(prev, owner))}
              testId={`dashboard-list-owner-filter-option-${owner}`}
            />
          ))
        ) : (
          <p className="text-sm text-gray-500 text-center py-2">No owners found</p>
        )}
      </div>
    </>
  );
}
