'use client';

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
  disabled?: boolean;
}

export function ConditionalFormattingSection({
  rules,
  onChange,
  availableColumns,
  columnTypeMap,
  disabled,
}: ConditionalFormattingSectionProps) {
  const isTextColumn = (col: string) => columnTypeMap?.[col] === 'text';

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
    field: keyof ConditionalFormattingRule,
    value: string | number
  ) => {
    const updated = rules.map((rule, i) => {
      if (i !== index) return rule;

      if (field === 'column') {
        // When the column changes, check if the type changed and reset operator/value accordingly
        const newCol = value as string;
        const newIsText = isTextColumn(newCol);
        const oldIsText = rule.type === 'text';

        if (newIsText !== oldIsText) {
          // Column type changed — reset to appropriate defaults
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
        // Same column type — just update the column name
        return { ...rule, column: newCol };
      }

      if (field === 'value') {
        // For text rules keep as string; for numeric rules coerce to number
        const ruleType = (rule as any).type ?? 'numeric';
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

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          No rules defined. Add a rule to highlight cells based on conditions.
        </p>
      )}

      <div className="space-y-3">
        {rules.map((rule, index) => {
          const ruleIsText = (rule as any).type === 'text' || isTextColumn(rule.column);
          const operators = ruleIsText ? TEXT_CONDITIONAL_OPERATORS : CONDITIONAL_OPERATORS;

          return (
            <div
              key={index}
              data-testid={`formatting-rule-${index}`}
              className="border rounded-md p-3 space-y-2"
            >
              {/* Row 1: Column + Operator + Value + Delete */}
              <div className="flex items-center gap-2">
                {/* Column selector */}
                <Select
                  value={rule.column}
                  onValueChange={(val) => handleUpdateRule(index, 'column', val)}
                  disabled={disabled}
                >
                  <SelectTrigger
                    data-testid={`rule-column-${index}`}
                    className="h-8 text-xs flex-1"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableColumns.map((col) => (
                      <SelectItem key={col} value={col}>
                        {col}
                      </SelectItem>
                    ))}
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
                    className="h-8 text-xs w-[130px]"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((op) => (
                      <SelectItem key={op.value} value={op.value}>
                        {op.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Value input — text or number depending on column type */}
                {ruleIsText ? (
                  <Input
                    type="text"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as string}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. active"
                    className="h-8 text-xs min-w-[80px] flex-1"
                  />
                ) : (
                  <Input
                    type="number"
                    data-testid={`rule-value-${index}`}
                    value={rule.value as number}
                    onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                    disabled={disabled}
                    className="h-8 text-xs w-[80px]"
                  />
                )}

                {/* Delete button */}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  data-testid={`delete-rule-${index}`}
                  onClick={() => handleDeleteRule(index)}
                  disabled={disabled}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>

              {/* Row 2: Color picker */}
              <ColorPicker
                value={rule.color}
                onChange={(color) => handleUpdateRule(index, 'color', color)}
                disabled={disabled}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
