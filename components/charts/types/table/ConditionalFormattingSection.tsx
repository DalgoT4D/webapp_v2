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
import { CONDITIONAL_OPERATORS, PRESET_COLORS } from './constants';
import type { ConditionalFormattingRule, ConditionalOperator } from './types';

interface ConditionalFormattingSectionProps {
  rules: ConditionalFormattingRule[];
  onChange: (rules: ConditionalFormattingRule[]) => void;
  availableColumns: string[];
  disabled?: boolean;
}

export function ConditionalFormattingSection({
  rules,
  onChange,
  availableColumns,
  disabled,
}: ConditionalFormattingSectionProps) {
  const handleAddRule = () => {
    const newRule: ConditionalFormattingRule = {
      column: availableColumns[0],
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
      if (field === 'value') {
        return { ...rule, [field]: Number(value) };
      }
      return { ...rule, [field]: value };
    });
    onChange(updated);
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
        {rules.map((rule, index) => (
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
                <SelectTrigger data-testid={`rule-column-${index}`} className="h-8 text-xs flex-1">
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
                  handleUpdateRule(index, 'operator', val as ConditionalOperator)
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
                  {CONDITIONAL_OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value input */}
              <Input
                type="number"
                data-testid={`rule-value-${index}`}
                value={rule.value}
                onChange={(e) => handleUpdateRule(index, 'value', e.target.value)}
                disabled={disabled}
                className="h-8 text-xs w-[80px]"
              />

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
        ))}
      </div>
    </div>
  );
}
