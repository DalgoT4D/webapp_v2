'use client';

import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TABLE_THEMES, DEFAULT_THEME_ID } from './constants';

interface AppearanceSectionProps {
  zebraRows: boolean;
  freezeFirstColumn: boolean;
  themeId?: string;
  onZebraRowsChange: (enabled: boolean) => void;
  onFreezeFirstColumnChange: (enabled: boolean) => void;
  onThemeChange?: (themeId: string) => void;
  disabled?: boolean;
}

export function AppearanceSection({
  zebraRows,
  freezeFirstColumn,
  themeId,
  onZebraRowsChange,
  onFreezeFirstColumnChange,
  onThemeChange,
  disabled,
}: AppearanceSectionProps) {
  const activeThemeId = themeId || DEFAULT_THEME_ID;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">Appearance</h4>

      <div className="space-y-3">
        {/* Theme Selector */}
        {onThemeChange && (
          <div className="space-y-2">
            <Label className="text-sm">Color theme</Label>
            <div className="flex gap-2" data-testid="theme-selector">
              {TABLE_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  data-testid={`theme-option-${theme.id}`}
                  disabled={disabled}
                  onClick={() => onThemeChange(theme.id)}
                  className={`flex flex-col items-center gap-1 rounded-md border-2 p-2 transition-colors ${
                    activeThemeId === theme.id
                      ? 'border-primary'
                      : 'border-transparent hover:border-muted-foreground/30'
                  } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {/* Mini preview swatch */}
                  <div
                    className="w-12 h-8 rounded overflow-hidden border"
                    style={{ borderColor: theme.border }}
                  >
                    <div className="h-1/3" style={{ backgroundColor: theme.header }} />
                    <div className="h-1/3" style={{ backgroundColor: theme.row }} />
                    <div className="h-1/3" style={{ backgroundColor: theme.zebraRow }} />
                  </div>
                  <span className="text-xs">{theme.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

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
