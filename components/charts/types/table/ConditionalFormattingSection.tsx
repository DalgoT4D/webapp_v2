'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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
  // Track the previous drillDownEnabled value to detect transitions
  const prevDrillDownRef = useRef<boolean | undefined>(undefined);
  const [showDrillOffPrompt, setShowDrillOffPrompt] = useState(false);

  useEffect(() => {
    const prev = prevDrillDownRef.current;
    prevDrillDownRef.current = drillDownEnabled;
    // Show prompt when drill-down transitions true → false and there are level-scoped rules
    if (prev === true && drillDownEnabled === false) {
      const hasLevelScoped = rules.some((r) => r.level !== undefined);
      if (hasLevelScoped) {
        setShowDrillOffPrompt(true);
      }
    }
  }, [drillDownEnabled, rules]);

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
        const ruleType = (rule as any).type ?? 'numeric';
        return { ...rule, value: ruleType === 'text' ? String(value) : Number(value) };
      }

      return { ...rule, [field]: value };
    });
    onChange(updated as ConditionalFormattingRule[]);
  };

  const handleKeepScopedRules = () => setShowDrillOffPrompt(false);

  const handleRemoveScopedRules = () => {
    onChange(rules.map((r) => ({ ...r, level: undefined })));
    setShowDrillOffPrompt(false);
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
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Conditional Formatting</h4>
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid="add-formatting-rule-btn"
          onClick={handleAddRule}
          disabled={disabled}
          className="h-7 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
      </div>

      {/* Drill-off prompt: shown when drill-down is turned OFF with level-scoped rules */}
      {showDrillOffPrompt && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start justify-between gap-2">
          <span>Drill-down is off. Level-scoped rules are inactive.</span>
          <div className="flex gap-3 flex-shrink-0">
            <button type="button" onClick={handleKeepScopedRules} className="underline font-medium">
              Keep
            </button>
            <button
              type="button"
              onClick={handleRemoveScopedRules}
              className="underline font-medium"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No rules defined. Add a rule to highlight cells based on conditions.
        </p>
      )}

      <div className="space-y-2">
        {rules.map((rule, index) => {
          const ruleIsText = (rule as any).type === 'text' || isTextColumn(rule.column);
          const operators = ruleIsText ? TEXT_CONDITIONAL_OPERATORS : CONDITIONAL_OPERATORS;
          const dimLevelLabel = getDimLevelLabel(rule.column);
          const isMetricCol = drillDownEnabled && !isDimensionCol(rule.column);

          return (
            <div
              key={index}
              data-testid={`formatting-rule-${index}`}
              className="space-y-2 p-3 border rounded-lg bg-white"
            >
              {/* All controls in one row — truncate text to prevent overflow */}
              <div className="flex items-center gap-1.5">
                {/* Column selector */}
                <Select
                  value={rule.column}
                  onValueChange={(val) => handleUpdateRule(index, 'column', val)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    data-testid={`rule-column-${index}`}
                    className="h-8 text-xs min-w-0 flex-[2]"
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

                {/* Operator selector */}
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
                    className="h-8 text-xs min-w-0 flex-[2]"
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

                {/* Value input */}
                {ruleIsText ? (
                  <Input
                    type="text"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as string}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. active"
                    className="h-8 text-xs min-w-0 flex-[1.5]"
                  />
                ) : (
                  <Input
                    type="number"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as number}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    className="h-8 text-xs min-w-0 flex-1"
                  />
                )}

                {/* Color swatch — opens ColorPicker in a popover */}
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

                {/* Level scope — only for metric columns when drill-down is on */}
                {isMetricCol && orderedDimensions && orderedDimensions.length > 0 && (
                  <Select
                    value={rule.level ?? '__all__'}
                    onValueChange={(val) =>
                      handleUpdateRule(index, 'level', val === '__all__' ? undefined : val)
                    }
                    disabled={disabled}
                  >
                    <SelectTrigger
                      data-testid={`rule-level-${index}`}
                      className="h-8 text-xs min-w-0 flex-[1.5]"
                    >
                      <span className="truncate">
                        <SelectValue placeholder="All levels" />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All levels</SelectItem>
                      {orderedDimensions.map((dimCol) => (
                        <SelectItem key={dimCol} value={dimCol}>
                          {dimCol} level
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Delete button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid={`delete-rule-${index}`}
                  onClick={() => handleDeleteRule(index)}
                  disabled={disabled}
                  className="h-8 w-8 flex-shrink-0 text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Annotations — only shown when relevant */}
              {drillDownEnabled && isDimensionCol(rule.column) && dimLevelLabel && (
                <p className="text-[11px] text-muted-foreground pl-1">
                  {dimLevelLabel === 'top level'
                    ? 'Active at the top level.'
                    : `Active ${dimLevelLabel}.`}
                </p>
              )}
              {ruleIsText && (
                <p className="text-[11px] text-muted-foreground pl-1">
                  Exact match, case-sensitive.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
