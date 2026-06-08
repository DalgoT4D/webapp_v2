'use client';

import { Plus, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ColorPicker } from './ColorPicker';
import { CONDITIONAL_OPERATORS, TEXT_CONDITIONAL_OPERATORS, PRESET_COLORS } from './constants';
import type {
  ConditionalFormattingRule,
  ConditionalOperator,
  TextConditionalOperator,
} from './types';

interface ConditionalFormattingSectionProps {
  rules: ConditionalFormattingRule[];
  onChange: (rules: ConditionalFormattingRule[]) => void;
  /** Full set of columns the user can target (all drill-down dims + metrics). */
  availableColumns: string[];
  /** Maps each column name to its type. Columns not in the map are treated as numeric. */
  columnTypeMap?: Record<string, 'numeric' | 'text'>;
  /** Whether drill-down is enabled on this chart */
  drillDownEnabled?: boolean;
  /** Ordered drill-down dimension column names, e.g. ['state', 'district', 'city'] */
  orderedDimensions?: string[];
  disabled?: boolean;
}

export function ConditionalFormattingSection({
  rules,
  onChange,
  availableColumns,
  columnTypeMap,
  drillDownEnabled,
  orderedDimensions,
  disabled,
}: ConditionalFormattingSectionProps) {
  // --- Drill-down helpers ---
  const isDimensionCol = (col: string) => !!(drillDownEnabled && orderedDimensions?.includes(col));

  const getDimLevelLabel = (col: string): string | undefined => {
    if (!drillDownEnabled || !orderedDimensions) return undefined;
    const idx = orderedDimensions.indexOf(col);
    if (idx < 0) return undefined;
    return idx === 0 ? 'top level' : `after drilling into ${orderedDimensions[idx - 1]}`;
  };

  // --- Column type helpers ---
  const isTextColumn = (col: string) => columnTypeMap?.[col] === 'text';

  // --- Rule handlers ---
  const handleAddRule = () => {
    const firstCol = availableColumns[0];
    const newRule: ConditionalFormattingRule = isTextColumn(firstCol)
      ? { type: 'text', column: firstCol, operator: '==', value: '', color: PRESET_COLORS[0].hex }
      : {
          type: 'numeric',
          column: firstCol,
          operator: '>',
          value: 0,
          color: PRESET_COLORS[0].hex,
        };
    onChange([...rules, newRule]);
  };

  const handleDeleteRule = (index: number) => {
    onChange(rules.filter((_, i) => i !== index));
  };

  const handleUpdateRule = (
    index: number,
    field: keyof ConditionalFormattingRule | 'level',
    value: string | number | undefined
  ) => {
    const updated = rules.map((rule, i) => {
      if (i !== index) return rule;

      if (field === 'level') {
        return { ...rule, level: value as string | undefined };
      }

      if (field === 'column') {
        const newCol = value as string;
        const newIsText = isTextColumn(newCol);
        const oldIsText = rule.type === 'text';
        if (newIsText !== oldIsText) {
          if (newIsText) {
            return {
              type: 'text' as const,
              column: newCol,
              operator: '==' as TextConditionalOperator,
              value: '',
              color: rule.color,
            };
          } else {
            return {
              type: 'numeric' as const,
              column: newCol,
              operator: '>' as ConditionalOperator,
              value: 0,
              color: rule.color,
            };
          }
        }
        return { ...rule, column: newCol };
      }

      if (field === 'value') {
        const ruleType = (rule as { type?: 'numeric' | 'text' }).type ?? 'numeric';
        return { ...rule, value: ruleType === 'text' ? String(value) : Number(value) };
      }

      return { ...rule, [field]: value };
    });
    onChange(updated as ConditionalFormattingRule[]);
  };

  if (availableColumns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Conditional Formatting</h4>
        <p className="text-sm text-muted-foreground text-center py-2">
          No columns available for formatting.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <h4 className="text-sm font-medium">Conditional Formatting</h4>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="About conditional formatting"
              data-testid="conditional-formatting-info"
              className="text-muted-foreground hover:text-foreground"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs text-xs leading-relaxed" side="right">
            Highlight cells based on conditions.
            <br />
            <br />
            <strong>Normal table:</strong> rules apply to every row in their column.
            <br />
            <br />
            <strong>Drill-down:</strong> rules on dimension columns apply only at that
            dimension&apos;s level. Rules on metric columns apply at every level by default, but can
            be scoped to a specific level.
          </TooltipContent>
        </Tooltip>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No rules defined. Add a rule to highlight cells based on conditions.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule, index) => {
          const ruleIsText =
            (rule as { type?: 'numeric' | 'text' }).type === 'text' || isTextColumn(rule.column);
          const operators = ruleIsText ? TEXT_CONDITIONAL_OPERATORS : CONDITIONAL_OPERATORS;
          const dimLevelLabel = getDimLevelLabel(rule.column);
          const isMetricCol = drillDownEnabled && !isDimensionCol(rule.column);

          const showLevelRow = !!(isMetricCol && orderedDimensions && orderedDimensions.length > 0);

          return (
            <div
              key={index}
              data-testid={`formatting-rule-${index}`}
              className="relative space-y-2 p-3 border rounded-lg bg-white"
            >
              {/* Delete button anchored on the top-right border corner */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                data-testid={`delete-rule-${index}`}
                onClick={() => handleDeleteRule(index)}
                disabled={disabled}
                aria-label="Delete rule"
                title="Delete rule"
                className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-destructive flex-shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>

              {/* Row 1: column + level scope (when applicable). Column leads;
                  "All levels" follows. pr-8 reserves room for the delete button
                  so it never overlaps the dropdowns. */}
              <div className="flex items-center gap-1.5 pr-8">
                <Select
                  value={rule.column}
                  onValueChange={(val) => handleUpdateRule(index, 'column', val)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    data-testid={`rule-column-${index}`}
                    className="h-8 text-sm min-w-0 flex-1"
                  >
                    <span className="truncate">
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col) => {
                      const dimLabel = getDimLevelLabel(col);
                      const isDim = isDimensionCol(col);
                      return (
                        <SelectItem key={col} value={col}>
                          <span>{col}</span>
                          {isDim && (
                            <span className="ml-1 text-xs text-muted-foreground">
                              {`(dim${dimLabel ? ` · ${dimLabel}` : ''})`}
                            </span>
                          )}
                          {!isDim && drillDownEnabled && (
                            <span className="ml-1 text-xs text-muted-foreground">(metric)</span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {showLevelRow && (
                  <Select
                    value={rule.level ?? '__all__'}
                    onValueChange={(val) =>
                      handleUpdateRule(index, 'level', val === '__all__' ? undefined : val)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger
                      data-testid={`rule-level-${index}`}
                      className="h-8 text-sm min-w-0 flex-1"
                    >
                      <span className="truncate">
                        <SelectValue placeholder="All levels" />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All levels</SelectItem>
                      {orderedDimensions!.map((dimCol) => (
                        <SelectItem key={dimCol} value={dimCol}>
                          {dimCol} level
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Row 2: operator + value + color */}
              <div className="flex items-center gap-1.5">
                <Select
                  value={rule.operator}
                  onValueChange={(val) =>
                    handleUpdateRule(
                      index,
                      'operator',
                      val as ConditionalOperator | TextConditionalOperator
                    )
                  }
                  disabled={disabled}
                >
                  <SelectTrigger
                    data-testid={`rule-operator-${index}`}
                    className="h-8 text-sm min-w-0 flex-1"
                  >
                    <span className="truncate">
                      <SelectValue />
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {ruleIsText ? (
                  <Input
                    type="text"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as string}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. active"
                    className="h-8 text-sm min-w-0 flex-1"
                  />
                ) : (
                  <Input
                    type="number"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as number}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    className="h-8 text-sm min-w-0 flex-1"
                  />
                )}
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid={`rule-color-${index}`}
                      disabled={disabled}
                      className="h-8 w-8 rounded-md border flex-shrink-0 cursor-pointer hover:ring-1 hover:ring-muted-foreground transition-all"
                      style={{ backgroundColor: rule.color }}
                      aria-label="Pick color"
                    />
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <ColorPicker
                      value={rule.color}
                      onChange={(color) => handleUpdateRule(index, 'color', color)}
                      disabled={disabled}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Drill-down scope hint: amber warning whenever the rule fires at exactly
                  one drill level. The only "no warning" case is a metric rule with no level —
                  that fires at every level. Wording flips based on which side of the drill
                  the rule lives on (top level vs. deeper). */}
              {(() => {
                if (!drillDownEnabled || !orderedDimensions || orderedDimensions.length === 0) {
                  return null;
                }
                const topLevelDim = orderedDimensions[0];
                const isDimColumn = orderedDimensions.includes(rule.column);

                let message: string | null = null;

                if (isDimColumn && rule.column !== topLevelDim) {
                  // Rule on a deeper drill dim — fires only after drilling in
                  const dimIdx = orderedDimensions.indexOf(rule.column);
                  const parent = orderedDimensions[dimIdx - 1];
                  message = `Only applies after drilling into ${parent}. Won't show at the top level.`;
                } else if (isDimColumn && rule.column === topLevelDim) {
                  // Rule on the first drill dim — fires only at the top level
                  message = `Only applies at the top level. Won't show after drilling in.`;
                } else if (rule.level !== undefined) {
                  // Metric rule with an explicit level scope
                  if (rule.level === topLevelDim) {
                    message = `Only applies at the top level. Won't show after drilling in.`;
                  } else {
                    message = `Only applies at the ${rule.level} level. Won't show at the top level.`;
                  }
                } else if (!isDimColumn) {
                  // Metric rule with no level scope → applies at every drill level
                  message = `Applies at every drill level.`;
                }

                if (!message) return null;

                return (
                  <p
                    className="text-[11px] text-muted-foreground"
                    data-testid={`rule-scope-hint-${index}`}
                  >
                    {message}
                  </p>
                );
              })()}
              {ruleIsText && (
                <p className="text-[11px] text-muted-foreground">Exact match, case-sensitive.</p>
              )}
            </div>
          );
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        data-testid="add-formatting-rule-btn"
        onClick={handleAddRule}
        disabled={disabled}
        className="w-full border-dashed bg-gray-900 text-white hover:bg-gray-700 hover:text-white border-gray-900"
      >
        <Plus className="h-4 w-4 mr-2" />
        ADD RULE
      </Button>
    </div>
  );
}
