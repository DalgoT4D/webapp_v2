# Table Chart Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 5 enhancements to the table chart: conditional formatting, column reordering, column alignment, zebra rows, and frozen first column.

**Architecture:** All enhancements are frontend-only, stored in `extra_config.customizations` (existing JSON field). The `TableChartCustomizations` panel gets restructured into sections. `TableChart` rendering applies the new customization props. No backend changes needed.

**Tech Stack:** React 19, TypeScript, @dnd-kit (already installed), Radix UI Switch, Tailwind CSS v4

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `components/charts/types/table/types.ts` | TypeScript interfaces for all table customization types |
| `components/charts/types/table/constants.ts` | Preset colors array, operator definitions |
| `components/charts/types/table/ColorPicker.tsx` | 8 preset color swatches + custom hex input |
| `components/charts/types/table/ConditionalFormattingSection.tsx` | Rule builder: add/edit/delete conditional formatting rules |
| `components/charts/types/table/ColumnOrderSection.tsx` | Drag-and-drop column reordering via @dnd-kit |
| `components/charts/types/table/ColumnAlignmentSection.tsx` | Per-column alignment override (left/center/right/auto) |
| `components/charts/types/table/AppearanceSection.tsx` | Zebra rows toggle + freeze first column toggle |
| `components/charts/types/table/__tests__/constants.test.ts` | Tests for constants |
| `components/charts/types/table/__tests__/ColorPicker.test.tsx` | Tests for ColorPicker |
| `components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx` | Tests for conditional formatting UI |
| `components/charts/types/table/__tests__/ColumnOrderSection.test.tsx` | Tests for column reorder UI |
| `components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx` | Tests for column alignment UI |
| `components/charts/types/table/__tests__/AppearanceSection.test.tsx` | Tests for appearance toggles |

### Modified Files

| File | Changes |
|------|---------|
| `components/charts/types/table/TableChartCustomizations.tsx` | Restructure into sections, import new section components |
| `components/charts/TableChart.tsx` | Apply conditional formatting, alignment, zebra rows, frozen column |
| `components/charts/ChartCustomizations.tsx` | Pass `allColumns` (not just numeric) + `table_columns` to TableChartCustomizations |
| `components/charts/ChartPreview.tsx` | Pass customizations through to TableChart |
| `app/charts/[id]/ChartDetailClient.tsx` | Pass customizations through to TableChart |
| `types/charts.ts` | Add conditional formatting types to ChartCreate/ChartUpdate extra_config |

---

## Task 1: Types and Constants

**Files:**
- Create: `components/charts/types/table/types.ts`
- Create: `components/charts/types/table/constants.ts`
- Create: `components/charts/types/table/__tests__/constants.test.ts`

- [ ] **Step 1: Create types file**

```typescript
// components/charts/types/table/types.ts

/** Operators available for conditional formatting rules */
export type ConditionalOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';

/** A single conditional formatting rule */
export interface ConditionalFormattingRule {
  column: string;
  operator: ConditionalOperator;
  value: number;
  color: string; // hex color e.g. "#C8E6C9"
}

/** Column alignment options */
export type ColumnAlignment = 'left' | 'center' | 'right';

/** All table customization settings stored in extra_config.customizations */
export interface TableCustomizations {
  /** Existing: per-column number formatting */
  columnFormatting?: Record<string, {
    numberFormat?: string;
    decimalPlaces?: number;
  }>;
  /** Conditional formatting rules */
  conditionalFormatting?: ConditionalFormattingRule[];
  /** Per-column alignment overrides (columns not listed use auto-detection) */
  columnAlignment?: Record<string, ColumnAlignment>;
  /** Enable alternating row backgrounds */
  zebraRows?: boolean;
  /** Pin first column when scrolling horizontally */
  freezeFirstColumn?: boolean;
}
```

- [ ] **Step 2: Create constants file**

```typescript
// components/charts/types/table/constants.ts

import type { ConditionalOperator } from './types';

/** Light pastel preset colors for conditional formatting */
export const PRESET_COLORS = [
  { hex: '#C8E6C9', label: 'Light Green' },
  { hex: '#FFCDD2', label: 'Light Red' },
  { hex: '#FFE0B2', label: 'Light Amber' },
  { hex: '#BBDEFB', label: 'Light Blue' },
  { hex: '#E1BEE7', label: 'Light Purple' },
  { hex: '#B2DFDB', label: 'Light Teal' },
  { hex: '#FFF9C4', label: 'Light Yellow' },
  { hex: '#F8BBD0', label: 'Light Pink' },
] as const;

/** Operators for conditional formatting with display labels */
export const CONDITIONAL_OPERATORS: Array<{
  value: ConditionalOperator;
  label: string;
}> = [
  { value: '>', label: 'Greater than (>)' },
  { value: '<', label: 'Less than (<)' },
  { value: '>=', label: 'Greater than or equal (>=)' },
  { value: '<=', label: 'Less than or equal (<=)' },
  { value: '==', label: 'Equal to (==)' },
  { value: '!=', label: 'Not equal to (!=)' },
] as const;

/** Regex for validating hex color codes */
export const HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
```

- [ ] **Step 3: Write test for constants**

```typescript
// components/charts/types/table/__tests__/constants.test.ts

import { PRESET_COLORS, CONDITIONAL_OPERATORS, HEX_COLOR_REGEX } from '../constants';

describe('Table chart constants', () => {
  it('has exactly 8 preset colors', () => {
    expect(PRESET_COLORS).toHaveLength(8);
  });

  it('all preset colors are valid hex codes', () => {
    PRESET_COLORS.forEach((color) => {
      expect(color.hex).toMatch(HEX_COLOR_REGEX);
    });
  });

  it('has all 6 conditional operators', () => {
    const operators = CONDITIONAL_OPERATORS.map((op) => op.value);
    expect(operators).toEqual(['>', '<', '>=', '<=', '==', '!=']);
  });

  it('HEX_COLOR_REGEX validates correctly', () => {
    expect(HEX_COLOR_REGEX.test('#C8E6C9')).toBe(true);
    expect(HEX_COLOR_REGEX.test('#c8e6c9')).toBe(true);
    expect(HEX_COLOR_REGEX.test('#FFF')).toBe(false);
    expect(HEX_COLOR_REGEX.test('C8E6C9')).toBe(false);
    expect(HEX_COLOR_REGEX.test('#ZZZZZZ')).toBe(false);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/constants.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/types.ts components/charts/types/table/constants.ts components/charts/types/table/__tests__/constants.test.ts
git commit -m "feat(table): add types and constants for table chart enhancements"
```

---

## Task 2: ColorPicker Component

**Files:**
- Create: `components/charts/types/table/ColorPicker.tsx`
- Create: `components/charts/types/table/__tests__/ColorPicker.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// components/charts/types/table/__tests__/ColorPicker.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { ColorPicker } from '../ColorPicker';

describe('ColorPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders 8 preset color swatches', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const swatches = screen.getAllByTestId(/^color-swatch-/);
    expect(swatches).toHaveLength(8);
  });

  it('calls onChange when a preset swatch is clicked', () => {
    render(<ColorPicker value="" onChange={mockOnChange} />);
    const firstSwatch = screen.getByTestId('color-swatch-0');
    fireEvent.click(firstSwatch);
    expect(mockOnChange).toHaveBeenCalledWith('#C8E6C9');
  });

  it('shows selected state on the active color', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const firstSwatch = screen.getByTestId('color-swatch-0');
    expect(firstSwatch.className).toContain('ring-2');
  });

  it('renders hex input field', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    expect(input).toBeInTheDocument();
  });

  it('calls onChange with valid hex from input', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    fireEvent.change(input, { target: { value: '#AABBCC' } });
    fireEvent.blur(input);
    expect(mockOnChange).toHaveBeenCalledWith('#AABBCC');
  });

  it('does not call onChange with invalid hex', () => {
    render(<ColorPicker value="#C8E6C9" onChange={mockOnChange} />);
    const input = screen.getByTestId('color-hex-input');
    fireEvent.change(input, { target: { value: 'invalid' } });
    fireEvent.blur(input);
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/charts/types/table/__tests__/ColorPicker.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ColorPicker**

```tsx
// components/charts/types/table/ColorPicker.tsx

'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { PRESET_COLORS, HEX_COLOR_REGEX } from './constants';

interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  disabled?: boolean;
}

export function ColorPicker({ value, onChange, disabled }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || '');

  const handleHexBlur = () => {
    if (HEX_COLOR_REGEX.test(hexInput)) {
      onChange(hexInput);
    }
  };

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setHexInput(newValue);
  };

  const handleSwatchClick = (hex: string) => {
    if (disabled) return;
    setHexInput(hex);
    onChange(hex);
  };

  return (
    <div className="space-y-2">
      {/* Preset color swatches */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color, index) => (
          <button
            key={color.hex}
            type="button"
            data-testid={`color-swatch-${index}`}
            className={`w-7 h-7 rounded-md border transition-all ${
              value === color.hex
                ? 'ring-2 ring-primary ring-offset-1'
                : 'hover:ring-1 hover:ring-muted-foreground'
            }`}
            style={{ backgroundColor: color.hex }}
            onClick={() => handleSwatchClick(color.hex)}
            disabled={disabled}
            title={color.label}
            aria-label={color.label}
          />
        ))}
      </div>

      {/* Custom hex input */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-md border flex-shrink-0"
          style={{
            backgroundColor: HEX_COLOR_REGEX.test(hexInput) ? hexInput : '#FFFFFF',
          }}
        />
        <Input
          data-testid="color-hex-input"
          value={hexInput}
          onChange={handleHexChange}
          onBlur={handleHexBlur}
          placeholder="#AABBCC"
          disabled={disabled}
          className="h-8 text-sm font-mono"
          maxLength={7}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/ColorPicker.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/ColorPicker.tsx components/charts/types/table/__tests__/ColorPicker.test.tsx
git commit -m "feat(table): add ColorPicker component with preset swatches and hex input"
```

---

## Task 3: ConditionalFormattingSection Component

**Files:**
- Create: `components/charts/types/table/ConditionalFormattingSection.tsx`
- Create: `components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { ConditionalFormattingSection } from '../ConditionalFormattingSection';

describe('ConditionalFormattingSection', () => {
  const defaultProps = {
    rules: [],
    onChange: jest.fn(),
    availableColumns: ['revenue', 'count', 'amount'],
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    expect(screen.getByText('Conditional Formatting')).toBeInTheDocument();
  });

  it('renders add rule button', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    expect(screen.getByTestId('add-formatting-rule-btn')).toBeInTheDocument();
  });

  it('adds a new rule with defaults when add button is clicked', () => {
    render(<ConditionalFormattingSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('add-formatting-rule-btn'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      {
        column: 'revenue',
        operator: '>',
        value: 0,
        color: '#C8E6C9',
      },
    ]);
  });

  it('renders existing rules', () => {
    const rules = [
      { column: 'revenue', operator: '>' as const, value: 10000, color: '#C8E6C9' },
      { column: 'count', operator: '<' as const, value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    const deleteButtons = screen.getAllByTestId(/^delete-rule-/);
    expect(deleteButtons).toHaveLength(2);
  });

  it('removes a rule when delete button is clicked', () => {
    const rules = [
      { column: 'revenue', operator: '>' as const, value: 10000, color: '#C8E6C9' },
      { column: 'count', operator: '<' as const, value: 5, color: '#FFCDD2' },
    ];
    render(<ConditionalFormattingSection {...defaultProps} rules={rules} />);
    fireEvent.click(screen.getByTestId('delete-rule-0'));
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { column: 'count', operator: '<', value: 5, color: '#FFCDD2' },
    ]);
  });

  it('shows empty state when no columns available', () => {
    render(<ConditionalFormattingSection {...defaultProps} availableColumns={[]} />);
    expect(screen.getByText(/No columns available/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ConditionalFormattingSection**

```tsx
// components/charts/types/table/ConditionalFormattingSection.tsx

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/ConditionalFormattingSection.tsx components/charts/types/table/__tests__/ConditionalFormattingSection.test.tsx
git commit -m "feat(table): add ConditionalFormattingSection with rule builder UI"
```

---

## Task 4: ColumnOrderSection Component

**Files:**
- Create: `components/charts/types/table/ColumnOrderSection.tsx`
- Create: `components/charts/types/table/__tests__/ColumnOrderSection.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// components/charts/types/table/__tests__/ColumnOrderSection.test.tsx

import { render, screen } from '@testing-library/react';
import { ColumnOrderSection } from '../ColumnOrderSection';

// Mock @dnd-kit following the project's existing pattern (see pipeline tests)
jest.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: any) => <div>{children}</div>,
  closestCenter: jest.fn(),
  KeyboardSensor: jest.fn(),
  PointerSensor: jest.fn(),
  useSensor: jest.fn(),
  useSensors: jest.fn(() => []),
}));

jest.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: any) => <div>{children}</div>,
  verticalListSortingStrategy: jest.fn(),
  useSortable: jest.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: jest.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
  arrayMove: jest.fn((arr: any[], from: number, to: number) => {
    const newArr = [...arr];
    const [removed] = newArr.splice(from, 1);
    newArr.splice(to, 0, removed);
    return newArr;
  }),
}));

jest.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: () => '' } },
}));

describe('ColumnOrderSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'region'],
    onChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnOrderSection {...defaultProps} />);
    expect(screen.getByText('Column Order')).toBeInTheDocument();
  });

  it('renders all columns as draggable items', () => {
    render(<ColumnOrderSection {...defaultProps} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('region')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(<ColumnOrderSection {...defaultProps} columns={[]} />);
    expect(screen.getByText(/No columns/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/charts/types/table/__tests__/ColumnOrderSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ColumnOrderSection**

This follows the exact same `@dnd-kit` pattern used in `components/charts/TableDimensionsSelector.tsx`.

```tsx
// components/charts/types/table/ColumnOrderSection.tsx

'use client';

import { GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface SortableColumnItemProps {
  id: string;
  column: string;
  disabled?: boolean;
}

function SortableColumnItem({ id, column, disabled }: SortableColumnItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 rounded-md border bg-background hover:bg-muted/30 transition-colors"
    >
      <button
        type="button"
        {...attributes}
        {...(disabled ? {} : listeners)}
        className={`touch-none flex-shrink-0 ${
          disabled
            ? 'cursor-not-allowed text-muted-foreground/50'
            : 'cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground'
        }`}
        aria-label={`Drag to reorder ${column}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-sm truncate">{column}</span>
    </div>
  );
}

interface ColumnOrderSectionProps {
  columns: string[];
  onChange: (columns: string[]) => void;
  disabled?: boolean;
}

export function ColumnOrderSection({ columns, onChange, disabled }: ColumnOrderSectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = columns.indexOf(active.id as string);
      const newIndex = columns.indexOf(over.id as string);
      onChange(arrayMove(columns, oldIndex, newIndex));
    }
  };

  if (columns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Column Order</h4>
        <p className="text-sm text-muted-foreground text-center py-2">
          No columns selected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Column Order</h4>
      <p className="text-xs text-muted-foreground">Drag to reorder columns</p>
      <div className="space-y-1">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns} strategy={verticalListSortingStrategy}>
            {columns.map((column) => (
              <SortableColumnItem
                key={column}
                id={column}
                column={column}
                disabled={disabled}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/ColumnOrderSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/ColumnOrderSection.tsx components/charts/types/table/__tests__/ColumnOrderSection.test.tsx
git commit -m "feat(table): add ColumnOrderSection with drag-and-drop reordering"
```

---

## Task 5: ColumnAlignmentSection Component

**Files:**
- Create: `components/charts/types/table/ColumnAlignmentSection.tsx`
- Create: `components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx

import { render, screen } from '@testing-library/react';
import { ColumnAlignmentSection } from '../ColumnAlignmentSection';

describe('ColumnAlignmentSection', () => {
  const defaultProps = {
    columns: ['name', 'revenue', 'count'],
    alignment: {} as Record<string, string>,
    onChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onChange.mockClear();
  });

  it('renders section heading', () => {
    render(<ColumnAlignmentSection {...defaultProps} />);
    expect(screen.getByText('Column Alignment')).toBeInTheDocument();
  });

  it('renders a row for each column', () => {
    render(<ColumnAlignmentSection {...defaultProps} />);
    expect(screen.getByText('name')).toBeInTheDocument();
    expect(screen.getByText('revenue')).toBeInTheDocument();
    expect(screen.getByText('count')).toBeInTheDocument();
  });

  it('shows empty state when no columns', () => {
    render(<ColumnAlignmentSection {...defaultProps} columns={[]} />);
    expect(screen.getByText(/No columns/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ColumnAlignmentSection**

```tsx
// components/charts/types/table/ColumnAlignmentSection.tsx

'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ColumnAlignment } from './types';

/** Alignment options shown in the dropdown */
const ALIGNMENT_OPTIONS: Array<{ value: 'auto' | ColumnAlignment; label: string }> = [
  { value: 'auto', label: 'Auto' },
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

interface ColumnAlignmentSectionProps {
  columns: string[];
  alignment: Record<string, ColumnAlignment>;
  onChange: (alignment: Record<string, ColumnAlignment>) => void;
  disabled?: boolean;
}

export function ColumnAlignmentSection({
  columns,
  alignment,
  onChange,
  disabled,
}: ColumnAlignmentSectionProps) {
  const handleAlignmentChange = (column: string, value: string) => {
    if (value === 'auto') {
      // Remove override — auto-detect will be used
      const updated = { ...alignment };
      delete updated[column];
      onChange(updated);
    } else {
      onChange({ ...alignment, [column]: value as ColumnAlignment });
    }
  };

  if (columns.length === 0) {
    return (
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Column Alignment</h4>
        <p className="text-sm text-muted-foreground text-center py-2">
          No columns selected.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">Column Alignment</h4>
      <p className="text-xs text-muted-foreground">
        Auto: numbers right-aligned, text left-aligned
      </p>
      <div className="space-y-1">
        {columns.map((column) => (
          <div
            key={column}
            className="flex items-center justify-between p-2 rounded-md border"
          >
            <span className="text-sm truncate flex-1 min-w-0 mr-2">{column}</span>
            <Select
              value={alignment[column] || 'auto'}
              onValueChange={(val) => handleAlignmentChange(column, val)}
              disabled={disabled}
            >
              <SelectTrigger
                data-testid={`alignment-${column}`}
                className="h-7 w-[90px] text-xs"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ALIGNMENT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/ColumnAlignmentSection.tsx components/charts/types/table/__tests__/ColumnAlignmentSection.test.tsx
git commit -m "feat(table): add ColumnAlignmentSection with per-column override"
```

---

## Task 6: AppearanceSection Component

**Files:**
- Create: `components/charts/types/table/AppearanceSection.tsx`
- Create: `components/charts/types/table/__tests__/AppearanceSection.test.tsx`

- [ ] **Step 1: Write the test**

```typescript
// components/charts/types/table/__tests__/AppearanceSection.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { AppearanceSection } from '../AppearanceSection';

describe('AppearanceSection', () => {
  const defaultProps = {
    zebraRows: false,
    freezeFirstColumn: false,
    onZebraRowsChange: jest.fn(),
    onFreezeFirstColumnChange: jest.fn(),
  };

  beforeEach(() => {
    defaultProps.onZebraRowsChange.mockClear();
    defaultProps.onFreezeFirstColumnChange.mockClear();
  });

  it('renders section heading', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByText('Appearance')).toBeInTheDocument();
  });

  it('renders zebra rows toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTestId('zebra-rows-switch')).toBeInTheDocument();
  });

  it('renders freeze first column toggle', () => {
    render(<AppearanceSection {...defaultProps} />);
    expect(screen.getByTestId('freeze-column-switch')).toBeInTheDocument();
  });

  it('calls onZebraRowsChange when toggled', () => {
    render(<AppearanceSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('zebra-rows-switch'));
    expect(defaultProps.onZebraRowsChange).toHaveBeenCalledWith(true);
  });

  it('calls onFreezeFirstColumnChange when toggled', () => {
    render(<AppearanceSection {...defaultProps} />);
    fireEvent.click(screen.getByTestId('freeze-column-switch'));
    expect(defaultProps.onFreezeFirstColumnChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- components/charts/types/table/__tests__/AppearanceSection.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AppearanceSection**

```tsx
// components/charts/types/table/AppearanceSection.tsx

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- components/charts/types/table/__tests__/AppearanceSection.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/charts/types/table/AppearanceSection.tsx components/charts/types/table/__tests__/AppearanceSection.test.tsx
git commit -m "feat(table): add AppearanceSection with zebra rows and freeze column toggles"
```

---

## Task 7: Restructure TableChartCustomizations

**Files:**
- Modify: `components/charts/types/table/TableChartCustomizations.tsx`
- Modify: `components/charts/ChartCustomizations.tsx:53-92,181-191`

The existing `TableChartCustomizations` currently only renders `NumberFormatSection` per numeric column. We need to restructure it to render all 5 customization sections, and update `ChartCustomizations` to pass `allColumns` and `tableColumns`.

- [ ] **Step 1: Update ChartCustomizations to pass allColumns and tableColumns**

In `components/charts/ChartCustomizations.tsx`, the `TABLE` case (lines 181-191) currently only passes `availableColumns={numericColumns}`. We need to also pass all columns and the current table_columns order.

Replace the TABLE case block (lines 181-191):

```typescript
    case ChartTypes.TABLE: {
      // numericColumns is computed in useMemo above
      // Stale formatting cleanup is handled in useEffect above
      
      // Get all displayed column names for non-numeric-only sections
      const allDisplayedColumns = formData.table_columns || [];

      return (
        <TableChartCustomizations
          customizations={customizations}
          updateCustomization={updateCustomization}
          disabled={disabled}
          availableColumns={numericColumns}
          allColumns={allDisplayedColumns}
          onTableColumnsChange={(newOrder: string[]) => {
            onChange({ table_columns: newOrder });
          }}
        />
      );
    }
```

- [ ] **Step 2: Rewrite TableChartCustomizations**

Replace the entire content of `components/charts/types/table/TableChartCustomizations.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, ChevronRight, ChevronDown } from 'lucide-react';
import { NumberFormats, type NumberFormat } from '@/lib/formatters';
import { NumberFormatSection } from '../shared/NumberFormatSection';
import { ConditionalFormattingSection } from './ConditionalFormattingSection';
import { ColumnOrderSection } from './ColumnOrderSection';
import { ColumnAlignmentSection } from './ColumnAlignmentSection';
import { AppearanceSection } from './AppearanceSection';
import type { ConditionalFormattingRule, ColumnAlignment } from './types';

interface ColumnFormatConfig {
  numberFormat?: NumberFormat;
  decimalPlaces?: number;
}

interface TableChartCustomizationsProps {
  customizations: Record<string, any>;
  updateCustomization: (key: string, value: any) => void;
  disabled?: boolean;
  /** Numeric columns only — for number formatting section */
  availableColumns?: string[];
  /** All displayed columns — for column order, alignment, conditional formatting */
  allColumns?: string[];
  /** Callback to update table_columns order in formData */
  onTableColumnsChange?: (columns: string[]) => void;
}

export function TableChartCustomizations({
  customizations,
  updateCustomization,
  disabled,
  availableColumns = [],
  allColumns = [],
  onTableColumnsChange,
}: TableChartCustomizationsProps) {
  // Currently expanded column for number formatting configuration
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  // Get existing customization values
  const columnFormatting: Record<string, ColumnFormatConfig> =
    customizations.columnFormatting || {};
  const conditionalFormatting: ConditionalFormattingRule[] =
    customizations.conditionalFormatting || [];
  const columnAlignment: Record<string, ColumnAlignment> =
    customizations.columnAlignment || {};
  const zebraRows: boolean = customizations.zebraRows || false;
  const freezeFirstColumn: boolean = customizations.freezeFirstColumn || false;

  // --- Number Formatting handlers (existing logic preserved) ---
  const handleToggleColumn = (column: string) => {
    setExpandedColumn(expandedColumn === column ? null : column);
  };

  const handleFormatChange = (column: string, numberFormat: NumberFormat) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: numberFormat,
        decimalPlaces: columnFormatting[column]?.decimalPlaces || 0,
      },
    };
    updateCustomization('columnFormatting', newFormatting);
  };

  const handleDecimalChange = (column: string, decimalPlaces: number) => {
    const newFormatting = {
      ...columnFormatting,
      [column]: {
        numberFormat: columnFormatting[column]?.numberFormat || 'default',
        decimalPlaces: decimalPlaces,
      },
    };
    updateCustomization('columnFormatting', newFormatting);
  };

  const handleRemoveFormat = (column: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFormatting = { ...columnFormatting };
    delete newFormatting[column];
    updateCustomization('columnFormatting', newFormatting);
    if (expandedColumn === column) {
      setExpandedColumn(null);
    }
  };

  const hasFormatting = (column: string) => !!columnFormatting[column];

  const getFormatDisplay = (column: string) => {
    const config = columnFormatting[column];
    const formatLabels: Record<string, string> = {
      default: 'No Formatting',
      indian: 'Indian',
      international: 'International',
      adaptive_indian: 'Adaptive Indian',
      adaptive_international: 'Adaptive International',
      european: 'European',
    };
    if (!config) return 'No Formatting';
    const hasDecimalPlaces = config.decimalPlaces !== undefined && config.decimalPlaces > 0;
    const isDefaultFormat = !config.numberFormat || config.numberFormat === 'default';
    if (isDefaultFormat && hasDecimalPlaces) {
      return `${config.decimalPlaces} decimal places`;
    }
    const formatLabel = formatLabels[config.numberFormat || 'default'] || config.numberFormat;
    const decimals = hasDecimalPlaces ? ` • ${config.decimalPlaces} dec` : '';
    return `${formatLabel}${decimals}`;
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Column Order */}
      {allColumns.length > 0 && onTableColumnsChange && (
        <ColumnOrderSection
          columns={allColumns}
          onChange={onTableColumnsChange}
          disabled={disabled}
        />
      )}

      {/* Section 2: Column Alignment */}
      {allColumns.length > 0 && (
        <ColumnAlignmentSection
          columns={allColumns}
          alignment={columnAlignment}
          onChange={(val) => updateCustomization('columnAlignment', val)}
          disabled={disabled}
        />
      )}

      {/* Section 3: Number Formatting (existing) */}
      {availableColumns.length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium">Number Formatting</h4>
          <div className="space-y-1">
            {availableColumns.map((column) => {
              const isExpanded = expandedColumn === column;
              const isConfigured = hasFormatting(column);
              const config = columnFormatting[column];

              return (
                <div key={column} className="space-y-0">
                  <div
                    data-testid={`column-row-${column}`}
                    className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${
                      isExpanded
                        ? 'shadow-sm'
                        : isConfigured
                          ? 'bg-muted/30 hover:bg-muted/50'
                          : 'hover:bg-muted/30'
                    }`}
                    onClick={() => handleToggleColumn(column)}
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{column}</div>
                        {!isExpanded && (
                          <div className="text-xs text-muted-foreground">
                            {getFormatDisplay(column)}
                          </div>
                        )}
                      </div>
                    </div>
                    {isConfigured && (
                      <Button
                        variant="ghost"
                        size="icon"
                        data-testid={`remove-format-${column}`}
                        className="h-6 w-6 text-black hover:text-destructive flex-shrink-0"
                        onClick={(e) => handleRemoveFormat(column, e)}
                        disabled={disabled}
                      >
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  {isExpanded && (
                    <div className="ml-6 py-3 space-y-3">
                      <NumberFormatSection
                        idPrefix={`table-${column}`}
                        numberFormat={config?.numberFormat}
                        decimalPlaces={config?.decimalPlaces}
                        onNumberFormatChange={(value) => handleFormatChange(column, value)}
                        onDecimalPlacesChange={(value) => handleDecimalChange(column, value)}
                        excludeFormats={[NumberFormats.PERCENTAGE, NumberFormats.CURRENCY]}
                        disabled={disabled}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Section 4: Conditional Formatting */}
      <ConditionalFormattingSection
        rules={conditionalFormatting}
        onChange={(rules) => updateCustomization('conditionalFormatting', rules)}
        availableColumns={allColumns.length > 0 ? allColumns : availableColumns}
        disabled={disabled}
      />

      {/* Section 5: Appearance */}
      <AppearanceSection
        zebraRows={zebraRows}
        freezeFirstColumn={freezeFirstColumn}
        onZebraRowsChange={(val) => updateCustomization('zebraRows', val)}
        onFreezeFirstColumnChange={(val) => updateCustomization('freezeFirstColumn', val)}
        disabled={disabled}
      />
    </div>
  );
}
```

- [ ] **Step 3: Run existing TableChartCustomizations tests to check for breakage**

Run: `npm run test -- components/charts/types/__tests__/TableChartCustomizations.test.tsx`
Expected: Some tests may need updates due to new props. Fix any failures by adding `allColumns` and `onTableColumnsChange` to test props.

- [ ] **Step 4: Update existing tests if needed**

If tests fail, update `defaultProps` in the test file to include:
```typescript
allColumns: ['revenue', 'sales', 'cost'],
onTableColumnsChange: jest.fn(),
```

- [ ] **Step 5: Run all table-related tests**

Run: `npm run test -- components/charts/types/table/ components/charts/types/__tests__/TableChartCustomizations.test.tsx`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add components/charts/types/table/TableChartCustomizations.tsx components/charts/ChartCustomizations.tsx components/charts/types/__tests__/TableChartCustomizations.test.tsx
git commit -m "feat(table): restructure TableChartCustomizations into sections with all enhancements"
```

---

## Task 8: Apply Enhancements to TableChart Rendering

**Files:**
- Modify: `components/charts/TableChart.tsx`

This is the core rendering task — apply conditional formatting colors, column alignment, zebra rows, and frozen first column to the actual table output.

- [ ] **Step 1: Update TableChartProps interface**

In `components/charts/TableChart.tsx`, update the `config` type in the `TableChartProps` interface (lines 58-96) to include the new customization fields:

Add these fields to the `config` type:

```typescript
interface TableChartProps {
  data?: Record<string, any>[];
  config?: {
    table_columns?: string[];
    column_formatting?: Record<
      string,
      {
        type?: 'currency' | 'percentage' | 'date' | 'number' | 'text';
        numberFormat?: NumberFormat;
        decimalPlaces?: number;
        /** @deprecated Use decimalPlaces instead. Kept for backwards compatibility. */
        precision?: number;
        prefix?: string;
        suffix?: string;
      }
    >;
    sort?: Array<{
      column: string;
      direction: 'asc' | 'desc';
    }>;
    pagination?: {
      enabled: boolean;
      page_size: number;
    };
    // New customization fields
    conditionalFormatting?: Array<{
      column: string;
      operator: string;
      value: number;
      color: string;
    }>;
    columnAlignment?: Record<string, string>;
    zebraRows?: boolean;
    freezeFirstColumn?: boolean;
  };
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  isLoading?: boolean;
  error?: any;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
  };
  onRowClick?: (rowData: Record<string, any>, columnName: string) => void;
  drillDownEnabled?: boolean;
  currentDimensionColumn?: string;
}
```

- [ ] **Step 2: Add helper functions for new features**

Add these helper functions after the existing `formatCellValue` function (after line 213):

```typescript
  // Evaluate conditional formatting rules for a cell
  const getConditionalColor = (value: any, column: string): string | undefined => {
    const rules = config.conditionalFormatting;
    if (!rules || rules.length === 0) return undefined;

    const numValue = Number(value);
    if (isNaN(numValue)) return undefined;

    // Last matching rule wins
    let matchedColor: string | undefined;
    for (const rule of rules) {
      if (rule.column !== column) continue;

      let matches = false;
      switch (rule.operator) {
        case '>':
          matches = numValue > rule.value;
          break;
        case '<':
          matches = numValue < rule.value;
          break;
        case '>=':
          matches = numValue >= rule.value;
          break;
        case '<=':
          matches = numValue <= rule.value;
          break;
        case '==':
          matches = numValue === rule.value;
          break;
        case '!=':
          matches = numValue !== rule.value;
          break;
      }
      if (matches) {
        matchedColor = rule.color;
      }
    }
    return matchedColor;
  };

  // Get alignment class for a column
  const getAlignmentClass = (column: string, sampleValue: any): string => {
    const explicitAlignment = config.columnAlignment?.[column];
    if (explicitAlignment) {
      switch (explicitAlignment) {
        case 'left':
          return 'text-left';
        case 'center':
          return 'text-center';
        case 'right':
          return 'text-right';
      }
    }
    // Auto-detect: check if value is numeric
    if (sampleValue != null) {
      const isNumeric = typeof sampleValue === 'number' || !isNaN(Number(sampleValue));
      return isNumeric ? 'text-right' : 'text-left';
    }
    return 'text-left';
  };
```

- [ ] **Step 3: Apply zebra rows to TableRow**

In the `<TableBody>` section (around line 320), update the `<TableRow>` to include zebra row styling:

Replace:
```tsx
              <TableRow
                key={index}
                className={
                  drillDownEnabled && currentDimensionColumn
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : ''
                }
              >
```

With:
```tsx
              <TableRow
                key={index}
                className={`${
                  drillDownEnabled && currentDimensionColumn
                    ? 'hover:bg-gray-50 cursor-pointer'
                    : ''
                } ${config.zebraRows && index % 2 === 1 ? 'bg-muted/30' : ''}`}
              >
```

- [ ] **Step 4: Apply alignment to TableHead**

Update the `<TableHead>` rendering (around line 294) to include alignment. We need to get a sample value from the first data row:

Replace:
```tsx
                  <TableHead key={column} className="font-semibold py-2 px-2">
```

With:
```tsx
                  <TableHead
                    key={column}
                    className={`font-semibold py-2 px-2 ${getAlignmentClass(column, data[0]?.[column])} ${
                      config.freezeFirstColumn && columns.indexOf(column) === 0
                        ? 'sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                        : ''
                    }`}
                  >
```

- [ ] **Step 5: Apply conditional formatting, alignment, and frozen column to TableCell**

Update the non-link `<TableCell>` rendering (around line 356). Replace the existing cell rendering block:

Replace:
```tsx
                  return (
                    <TableCell
                      key={column}
                      className={`py-1.5 px-2 ${
                        isDrillDownClickable
                          ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer'
                          : ''
                      }`}
                      onClick={
                        isDrillDownClickable
                          ? () => {
                              onRowClick(row, column);
                            }
                          : undefined
                      }
                    >
                      {cellValue}
                    </TableCell>
                  );
```

With:
```tsx
                  const conditionalColor = getConditionalColor(rawValue, column);
                  const alignClass = getAlignmentClass(column, rawValue);
                  const isFrozen = config.freezeFirstColumn && columns.indexOf(column) === 0;

                  return (
                    <TableCell
                      key={column}
                      className={`py-1.5 px-2 ${alignClass} ${
                        isDrillDownClickable
                          ? 'text-blue-600 hover:text-blue-800 hover:underline cursor-pointer'
                          : ''
                      } ${
                        isFrozen
                          ? 'sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                          : ''
                      }`}
                      style={conditionalColor ? { backgroundColor: conditionalColor } : undefined}
                      onClick={
                        isDrillDownClickable
                          ? () => {
                              onRowClick(row, column);
                            }
                          : undefined
                      }
                    >
                      {cellValue}
                    </TableCell>
                  );
```

- [ ] **Step 6: Also apply alignment and frozen column to link cells**

Update the link `<TableCell>` (around line 339) similarly:

Replace:
```tsx
                    return (
                      <TableCell key={column} className="py-1.5 px-2">
```

With:
```tsx
                    const linkAlignClass = getAlignmentClass(column, rawValue);
                    const isLinkFrozen = config.freezeFirstColumn && columns.indexOf(column) === 0;

                    return (
                      <TableCell
                        key={column}
                        className={`py-1.5 px-2 ${linkAlignClass} ${
                          isLinkFrozen
                            ? 'sticky left-0 z-10 bg-background border-r shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
                            : ''
                        }`}
                      >
```

- [ ] **Step 7: Run existing TableChart tests**

Run: `npm run test -- --testPathPattern="TableChart"`
Expected: PASS (existing tests should still pass since new features are opt-in via config)

- [ ] **Step 8: Commit**

```bash
git add components/charts/TableChart.tsx
git commit -m "feat(table): apply conditional formatting, alignment, zebra rows, frozen column in TableChart"
```

---

## Task 9: Pass Customizations Through ChartPreview and ChartDetailClient

**Files:**
- Modify: `components/charts/ChartPreview.tsx:359-381`
- Modify: `app/charts/[id]/ChartDetailClient.tsx:815-856`

- [ ] **Step 1: Update ChartPreview to pass new customization fields**

In `components/charts/ChartPreview.tsx`, the table chart rendering block (lines 359-381) merges `customizations.columnFormatting` into `config.column_formatting`. We need to also pass through the new fields.

Replace lines 359-381:

```typescript
  // Render table chart
  if (chartType === ChartTypes.TABLE) {
    // Merge customizations into config for table charts
    const customizations = propCustomizations || config?.extra_config?.customizations || {};
    const tableConfig = {
      ...config,
      ...(customizations?.columnFormatting
        ? {
            column_formatting: {
              ...(config?.column_formatting || {}),
              ...customizations.columnFormatting,
            },
          }
        : {}),
      conditionalFormatting: customizations?.conditionalFormatting || [],
      columnAlignment: customizations?.columnAlignment || {},
      zebraRows: customizations?.zebraRows || false,
      freezeFirstColumn: customizations?.freezeFirstColumn || false,
    };

    return (
      <TableChart
        data={tableData}
        config={tableConfig}
        onSort={onTableSort}
        pagination={tablePagination}
      />
    );
  }
```

- [ ] **Step 2: Update ChartDetailClient to pass new customization fields**

In `app/charts/[id]/ChartDetailClient.tsx`, the table chart `config` prop (lines 817-827) needs the new fields. Replace the config object:

```typescript
                    <TableChart
                      data={Array.isArray(tableData?.data) ? tableData.data : []}
                      config={{
                        table_columns:
                          tableData?.columns || chart.extra_config?.table_columns || [],
                        column_formatting:
                          chart.extra_config?.customizations?.columnFormatting || {},
                        sort: chart.extra_config?.sort || [],
                        pagination: chart.extra_config?.pagination || {
                          enabled: true,
                          page_size: 20,
                        },
                        conditionalFormatting:
                          chart.extra_config?.customizations?.conditionalFormatting || [],
                        columnAlignment:
                          chart.extra_config?.customizations?.columnAlignment || {},
                        zebraRows:
                          chart.extra_config?.customizations?.zebraRows || false,
                        freezeFirstColumn:
                          chart.extra_config?.customizations?.freezeFirstColumn || false,
                      }}
                      isLoading={tableLoading}
                      error={tableError}
```

- [ ] **Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes (TypeScript errors are ignored during build, but this confirms no import issues)

- [ ] **Step 4: Commit**

```bash
git add components/charts/ChartPreview.tsx app/charts/[id]/ChartDetailClient.tsx
git commit -m "feat(table): pass table customizations through ChartPreview and ChartDetailClient"
```

---

## Task 10: Update Types in charts.ts

**Files:**
- Modify: `types/charts.ts`

- [ ] **Step 1: Add conditional formatting types to ChartCreate extra_config**

In `types/charts.ts`, add the new customization fields to the `customizations` type within `ChartCreate.extra_config` (around line 137). The `customizations` field is currently `Record<string, any>` — we keep it that way since it's a flexible bag, but we document the expected shape.

No actual type changes needed since `customizations` is already `Record<string, any>`. The concrete types live in `components/charts/types/table/types.ts` and are used at the component level.

This step is a no-op — the types are already flexible enough. Skip to commit.

- [ ] **Step 2: Commit (no changes needed — types already flexible)**

This task is complete with no code changes. The `Record<string, any>` on `customizations` already supports the new fields. The concrete interfaces in `components/charts/types/table/types.ts` (Task 1) provide type safety at the component level.

---

## Task 11: Manual Testing Checklist

This is not a code task — it's a verification checklist for the developer to manually test in the browser.

- [ ] **Step 1: Test conditional formatting**
1. Create or edit a table chart
2. In customizations panel, expand "Conditional Formatting"
3. Add a rule: column = a numeric column, operator = ">", value = some threshold, pick a color
4. Verify the preview table shows cells highlighted with the chosen color
5. Add a second rule with a different color for the same column
6. Verify last-matching-rule-wins behavior
7. Test custom hex input — enter a valid hex, verify color applies
8. Save the chart, reload page, verify formatting persists

- [ ] **Step 2: Test column reordering**
1. Create a table chart with 3+ columns
2. In customizations panel, use "Column Order" section
3. Drag a column to a new position
4. Verify the preview table reflects the new column order
5. Save and reload — verify order persists

- [ ] **Step 3: Test column alignment**
1. Create a table chart with both text and numeric columns
2. Verify auto-detection: numbers should be right-aligned, text left-aligned
3. Override a column to center alignment
4. Verify the table reflects the override
5. Set back to "Auto" and verify it reverts

- [ ] **Step 4: Test zebra rows**
1. Toggle "Zebra rows" on in Appearance section
2. Verify alternating row backgrounds appear
3. Toggle off — verify rows return to uniform background
4. With zebra rows on, add conditional formatting — verify conditional formatting color takes precedence on formatted cells

- [ ] **Step 5: Test frozen first column**
1. Create a table with many columns that causes horizontal scroll
2. Toggle "Freeze first column" on
3. Scroll horizontally — verify first column stays pinned with a subtle shadow separator
4. Toggle off — verify first column scrolls normally
