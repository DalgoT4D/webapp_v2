'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface AppearanceSectionProps {
  zebraRows: boolean;
  freezeFirstColumn: boolean;
  onZebraRowsChange: (enabled: boolean) => void;
  onFreezeFirstColumnChange: (enabled: boolean) => void;
  disabled?: boolean;
}

export function AppearanceSection({
  zebraRows,
  freezeFirstColumn,
  onZebraRowsChange,
  onFreezeFirstColumnChange,
  disabled,
}: AppearanceSectionProps) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Appearance</h4>

      <div className="space-y-3">
        {/* Zebra Rows Toggle */}
        <div className="flex items-center justify-between p-2 rounded-md border">
          <div>
            <Label htmlFor="zebra-rows" className="text-sm cursor-pointer">
              Zebra rows
            </Label>
            <p className="text-xs text-muted-foreground">
              Alternating row backgrounds for readability
            </p>
          </div>
          <Switch
            id="zebra-rows"
            data-testid="zebra-rows-switch"
            checked={zebraRows}
            onCheckedChange={onZebraRowsChange}
            disabled={disabled}
          />
        </div>

        {/* Freeze First Column Toggle */}
        <div className="flex items-center justify-between p-2 rounded-md border">
          <div>
            <Label htmlFor="freeze-column" className="text-sm cursor-pointer">
              Freeze first column
            </Label>
            <p className="text-xs text-muted-foreground">
              Pin the first column when scrolling horizontally
            </p>
          </div>
          <Switch
            id="freeze-column"
            data-testid="freeze-column-switch"
            checked={freezeFirstColumn}
            onCheckedChange={onFreezeFirstColumnChange}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}
