'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface OptionCheckboxRowProps {
  label: string;
  isChecked: boolean;
  onToggle: () => void;
  testId: string;
  /** LIST-DRIFT: charts put a testid on the checkbox; dashboards don't. */
  checkboxTestId?: string;
  /** LIST-DRIFT: chart-type options show "bar" as "Bar". */
  isCapitalized?: boolean;
}

/** One clickable option in a multi-select column filter (the whole row toggles). */
export function OptionCheckboxRow({
  label,
  isChecked,
  onToggle,
  testId,
  checkboxTestId,
  isCapitalized = false,
}: OptionCheckboxRowProps) {
  return (
    <div
      data-testid={testId}
      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded"
      onClick={onToggle}
    >
      <Checkbox
        data-testid={checkboxTestId}
        checked={isChecked}
        onChange={() => {}} // Handled by parent onClick
      />
      <Label
        className={
          isCapitalized
            ? 'text-sm cursor-pointer flex-1 text-gray-900 capitalize'
            : 'text-sm cursor-pointer flex-1 text-gray-900'
        }
      >
        {label}
      </Label>
    </div>
  );
}
