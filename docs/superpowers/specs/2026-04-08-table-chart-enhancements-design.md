# Table Chart Enhancements — Design Spec

**Date:** 2026-04-08
**Status:** Draft
**Scope:** 5 table chart enhancements for NGO data readability

## Overview

The current table chart is a plain HTML table with sorting, pagination, column formatting, and drill-down. This spec covers 5 enhancements to make it more useful for NGO users reviewing data:

1. Conditional formatting (rule-based cell highlighting)
2. Column reordering (drag-and-drop in config panel)
3. Column alignment (auto-detect numeric vs text)
4. Zebra rows (alternating row backgrounds)
5. Frozen first column (sticky on horizontal scroll)

## 1. Conditional Formatting

### Behavior
- Users define rules per column: pick a column, an operator, a value, and a color
- Multiple rules can exist per column and across columns
- Rules apply to **cell background color only** (no text color changes)
- Only **numeric operators** supported: `>`, `<`, `>=`, `<=`, `==`, `!=`
- Rules are evaluated top-to-bottom; if multiple rules match a cell, the **last matching rule wins**

### Color Selection
- **8 preset light pastel colors** shown as clickable swatches for quick selection:
  - Light Green: `#C8E6C9`
  - Light Red: `#FFCDD2`
  - Light Amber: `#FFE0B2`
  - Light Blue: `#BBDEFB`
  - Light Purple: `#E1BEE7`
  - Light Teal: `#B2DFDB`
  - Light Yellow: `#FFF9C4`
  - Light Pink: `#F8BBD0`
- **Custom hex input** below the swatches with live preview swatch
- Hex input validated (must be valid 6-digit hex with `#` prefix)
- Backend always stores hex codes regardless of selection method

### UI Location
- New "Conditional Formatting" section in `TableChartCustomizations` panel
- "Add Rule" button to create a new rule
- Each rule shows: column dropdown, operator dropdown, value input, color picker, delete button
- Rules are collapsible/expandable

### Storage
```json
{
  "customizations": {
    "conditionalFormatting": [
      {
        "column": "revenue",
        "operator": ">",
        "value": 10000,
        "color": "#C8E6C9"
      },
      {
        "column": "revenue",
        "operator": "<",
        "value": 1000,
        "color": "#FFCDD2"
      }
    ]
  }
}
```

### Rendering
- In `TableChart.tsx`, after formatting the cell value, check conditional formatting rules for the cell's column
- Apply matching rule's color as `style={{ backgroundColor: color }}` on the `<TableCell>`
- Last matching rule wins (rules evaluated in array order)

---

## 2. Column Reordering

### Behavior
- Drag-and-drop reordering in the **configuration panel only** (not on the rendered table)
- Uses `@dnd-kit` (already installed)
- The `table_columns` array order determines display order (already the case)
- Reordering updates the `table_columns` array in config

### UI Location
- New "Column Order" section at the **top** of `TableChartCustomizations` panel (since it affects all other column-specific sections)
- Each column shown as a draggable row with a grip handle
- Drag to reorder, order saved immediately on drop

### Storage
No new field needed — `table_columns` array order IS the column order:
```json
{
  "extra_config": {
    "table_columns": ["name", "region", "revenue", "beneficiaries"]
  }
}
```

### Implementation Note
- The existing `SimpleTableConfiguration` handles column **selection** (checkboxes)
- Column **order** is a separate concern in the customizations panel
- When columns are added/removed via selection, they append to / remove from the `table_columns` array
- Reordering only rearranges the existing array

---

## 3. Column Alignment

### Behavior
- **Auto-detect by default**: numeric columns right-aligned, text columns left-aligned
- Users can override alignment per column: left, center, right
- Auto-detection uses the column data types or inspects first non-null value in data

### UI Location
- New "Column Alignment" section in `TableChartCustomizations` panel
- Per-column dropdown with options: Auto (default), Left, Center, Right
- "Auto" label shows the detected alignment in parentheses, e.g., "Auto (right)"

### Storage
```json
{
  "customizations": {
    "columnAlignment": {
      "revenue": "right",
      "name": "left",
      "count": "center"
    }
  }
}
```
Columns not in this map use auto-detection.

### Rendering
- In `TableChart.tsx`, apply `text-left`, `text-right`, or `text-center` classes to both `<TableHead>` and `<TableCell>` for each column
- Auto-detection logic: if the first non-null value in the column `typeof value === 'number'` or `!isNaN(Number(value))` → right-align, else left-align

---

## 4. Zebra Rows

### Behavior
- Alternating row background colors for readability
- Toggle on/off in customizations
- **Off by default** (matches current behavior)
- Uses a subtle light gray for even rows: `bg-muted/30` (Tailwind)

### UI Location
- "Appearance" section at the bottom of `TableChartCustomizations` panel
- Simple toggle switch: "Zebra rows"

### Storage
```json
{
  "customizations": {
    "zebraRows": true
  }
}
```

### Rendering
- In `TableChart.tsx`, add conditional class to `<TableRow>`:
  ```tsx
  className={index % 2 === 0 ? 'bg-muted/30' : ''}
  ```
- Conditional formatting background colors take precedence over zebra striping (if a cell has a conditional format rule that matches, its background wins)

---

## 5. Frozen First Column

### Behavior
- When enabled, the first column stays fixed while the rest of the table scrolls horizontally
- Toggle on/off in customizations
- **Off by default**
- Only relevant when the table has enough columns to cause horizontal scrolling

### UI Location
- "Appearance" section in `TableChartCustomizations` panel (same section as zebra rows)
- Simple toggle switch: "Freeze first column"

### Storage
```json
{
  "customizations": {
    "freezeFirstColumn": true
  }
}
```

### Rendering
- First column `<TableHead>` and `<TableCell>` get:
  ```css
  position: sticky;
  left: 0;
  z-index: 1;
  background-color: inherit; /* or explicit bg to prevent transparency */
  ```
- Add a subtle right border/shadow on the frozen column to visually separate it

---

## Combined Storage Example

All enhancements stored in `extra_config.customizations`:

```json
{
  "extra_config": {
    "table_columns": ["name", "region", "revenue", "beneficiaries"],
    "customizations": {
      "columnFormatting": {
        "revenue": { "numberFormat": "indian", "decimalPlaces": 2 }
      },
      "conditionalFormatting": [
        { "column": "revenue", "operator": ">", "value": 10000, "color": "#C8E6C9" },
        { "column": "revenue", "operator": "<", "value": 1000, "color": "#FFCDD2" }
      ],
      "columnAlignment": {
        "revenue": "right"
      },
      "zebraRows": true,
      "freezeFirstColumn": false
    }
  }
}
```

No backend changes or migrations needed. All logic is frontend-only.

---

## Files to Modify

| File | Changes |
|------|---------|
| `components/charts/TableChart.tsx` | Apply conditional formatting colors, column alignment, zebra rows, frozen column |
| `components/charts/types/table/TableChartCustomizations.tsx` | Add all 5 customization sections (restructure into sections) |
| `types/charts.ts` | Add TypeScript interfaces for new customization types |
| `components/charts/ChartPreview.tsx` | Pass new customization props through to TableChart |
| `app/charts/[id]/ChartDetailClient.tsx` | Pass new customization props through to TableChart |

New files:
| File | Purpose |
|------|---------|
| `components/charts/types/table/ConditionalFormattingSection.tsx` | Rule builder UI with color picker |
| `components/charts/types/table/ColumnOrderSection.tsx` | Drag-and-drop column reorder |
| `components/charts/types/table/ColumnAlignmentSection.tsx` | Per-column alignment controls |
| `components/charts/types/table/AppearanceSection.tsx` | Zebra rows + freeze column toggles |
| `components/charts/types/table/ColorPicker.tsx` | Preset swatches + hex input component |
| `components/charts/types/table/constants.ts` | Preset colors, operators list |
| `components/charts/types/table/types.ts` | TypeScript interfaces for all customization types |

---

## Out of Scope

- Text/string conditional formatting operators (future enhancement)
- Column renaming/aliases (handled in transform/DBT layer)
- Totals/summary row (handled in transform/DBT layer)
- Inline column reordering on rendered table (can add later if requested)
- Text color changes for conditional formatting (light backgrounds ensure readability)
