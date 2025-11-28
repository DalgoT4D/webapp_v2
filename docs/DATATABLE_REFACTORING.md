# DataTable Component Refactoring Plan

This document tracks the progress of refactoring the table components across Charts, Dashboards, and Users pages into a unified, reusable DataTable component.

## Table of Contents
- [Overview](#overview)
- [Progress Status](#progress-status)
- [NPM Packages Analysis](#npm-packages-analysis)
- [Functionality Checklist](#functionality-checklist)
- [Component Architecture](#component-architecture)
- [File Structure](#file-structure)
- [Usage Examples](#usage-examples)
- [Remaining Work](#remaining-work)
- [How to Continue](#how-to-continue)

---

## Overview

**Goal**: Create a single, reusable `DataTable` component using TanStack Table that can replace the table implementations in:
1. `app/charts/page.tsx` ✅ COMPLETED
2. `components/dashboard/dashboard-list-v2.tsx` ⏳ PENDING
3. `components/settings/user-management/UsersTable.tsx` ⏳ PENDING

**Benefits**:
- Reduced code duplication (~3000+ lines → ~1500 lines)
- Consistent UX across all tables
- Easier maintenance and feature additions
- Type-safe with TypeScript generics

---

## Progress Status

| Task | Status | Notes |
|------|--------|-------|
| Create functionality checklist | ✅ Done | Documented all features for each table |
| Install TanStack Table | ✅ Done | `@tanstack/react-table@8.21.3` |
| Create base DataTable component | ✅ Done | See `components/ui/data-table/` |
| Create filter components | ✅ Done | Text, Checkbox, Date filters |
| Migrate Charts page | ✅ Done | ~1450 lines → ~820 lines |
| Refactor pagination to use TanStack built-in | ✅ Done | Uses `getPaginationRowModel()` |
| Migrate Dashboard list | ⏳ Pending | ~2030 lines (complex with pinning) |
| Migrate Users table | ⏳ Pending | ~500 lines (simpler) |
| Enhance DateFilter with react-day-picker | ⏳ Pending | Package already installed |
| Test functionality parity | ⏳ Pending | Manual testing required |

---

## NPM Packages Analysis

### Currently Used (Good Choices ✅)

| Package | Version | Purpose | Keep? |
|---------|---------|---------|-------|
| `@tanstack/react-table` | 8.21.3 | Table logic | ✅ Perfect choice |
| `react-day-picker` | 9.6.7 | Date picker | ✅ Already in project |
| `date-fns` | 4.1.0 | Date formatting | ✅ Already in project |
| `@radix-ui/*` | Various | UI primitives | ✅ Used for Popover, Select, etc. |

### Recommendations for Improvement

#### 1. **Pagination** - Using TanStack Table's Built-in ✅ IMPLEMENTED
TanStack Table has excellent built-in pagination support. No additional package needed!

**What we implemented**:
- `getPaginationRowModel()` - Client-side pagination
- Internal pagination state managed by TanStack Table
- `DataTablePagination.tsx` receives the table instance and controls it via:
  - `table.previousPage()` / `table.nextPage()`
  - `table.setPageSize()`
  - `table.getCanPreviousPage()` / `table.getCanNextPage()`
  - `table.getPageCount()`

**Simplified API** - The parent component just passes:
```tsx
pagination={{
  totalRows: data.length,
  initialPageSize: 10,
  pageSizeOptions: [10, 20, 50, 100],
}}
```

**Reference**: [TanStack Table Pagination Guide](https://tanstack.com/table/v8/docs/guide/pagination)

#### 2. **Date Range Picker** - Already Have `react-day-picker`

The project already has `react-day-picker@9.6.7` which is great! However, it's not being used in our DateFilter component.

**Recommendation**: Update `DateFilter.tsx` to use `react-day-picker` instead of plain HTML date inputs:

```tsx
import { DateRange, DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';

// Better UX with calendar popup
<DayPicker
  mode="range"
  selected={dateRange}
  onSelect={setDateRange}
/>
```

**Reference**: [react-day-picker docs](https://react-day-picker.js.org/)

#### 3. **Virtual Scrolling** (Future Enhancement)
For tables with 1000+ rows, consider adding:

```bash
npm install @tanstack/react-virtual
```

This enables virtual scrolling for better performance with large datasets.

**Reference**: [TanStack Virtual](https://tanstack.com/virtual/latest)

#### 4. **Column Resizing** (Optional Enhancement)
TanStack Table supports column resizing out of the box - just need to enable it:

```tsx
const table = useReactTable({
  // ...
  enableColumnResizing: true,
  columnResizeMode: 'onChange',
});
```

### Packages NOT Recommended

| Package | Reason to Skip |
|---------|----------------|
| `react-table` (v7) | TanStack Table (v8) is the successor |
| `ag-grid` | Overkill, large bundle, different styling |
| `material-table` | MUI dependency, not needed |
| Separate pagination libs | TanStack has it built-in |

---

## Functionality Checklist

### Charts Page (`app/charts/page.tsx`) ✅ MIGRATED

#### Header Section
- [x] Page title "Charts" with description
- [x] "CREATE CHART" button (permission: `can_create_charts`)

#### Selection Mode
- [x] Enter selection mode via dropdown "Select" option
- [x] Exit selection mode (X button)
- [x] Toggle individual chart selection
- [x] Select All / Deselect All buttons
- [x] Selected count display
- [x] Bulk delete with confirmation dialog
- [x] Bulk delete loading state

#### Sorting (4 columns)
- [x] Sort by Title, Data Source, Chart Type, Last Modified
- [x] Sort icon states (neutral, asc, desc)

#### Filtering
- [x] Name Filter: Text search + Show favorites checkbox
- [x] Data Source Filter: Searchable checkbox list
- [x] Chart Type Filter: Checkbox list
- [x] Date Filter: All/Today/Week/Month/Custom range
- [x] Filter active indicator (teal dot)
- [x] Filter summary bar + Clear all

#### Table Columns
- [x] Name: Star toggle + clickable title
- [x] Data Source: schema.table format
- [x] Type: Icon with colored background + tooltip
- [x] Last Modified: Relative time
- [x] Actions: Edit button + 3-dot dropdown

#### Actions Dropdown
- [x] Select (enters selection mode)
- [x] Duplicate with loading state
- [x] Export (ChartExportDropdownForList)
- [x] Delete with ChartDeleteDialog

#### Pagination
- [x] Item count (X–Y of Z)
- [x] Page size selector (10, 20, 50, 100)
- [x] Prev/Next buttons
- [x] Current page indicator

#### States
- [x] Loading skeleton
- [x] Empty state with CREATE button
- [x] Filtered empty state
- [x] Error state with retry

---

### Dashboard List (`components/dashboard/dashboard-list-v2.tsx`) ⏳ PENDING

#### Header Section
- [ ] Page title "Dashboards" with description
- [ ] "CREATE DASHBOARD" button

#### Sorting (3 columns)
- [ ] Sort by Name, Owner, Last Modified

#### Filtering
- [ ] Name Filter: Text + favorites + locked + shared checkboxes
- [ ] Owner Filter: Searchable checkbox list
- [ ] Date Filter: Same as charts

#### Table Columns
- [ ] Name: Star + title + badges (My Landing, Org Default, Locked)
- [ ] Owner: Avatar + name
- [ ] Last Modified: Relative time
- [ ] Actions: Edit + Share + 3-dot dropdown

#### Actions Dropdown
- [ ] "Landing Page" section header
- [ ] Set/Remove as my landing page
- [ ] Set as org default (permission check)
- [ ] Duplicate with loading state
- [ ] Delete with AlertDialog

#### Pinned Rows (Special Feature)
- [ ] Personal landing page pinned at top
- [ ] Org default pinned at top
- [ ] Pinned rows NOT paginated out

#### Other
- [ ] Share modal integration
- [ ] Landing page API integration
- [ ] Grid/List view (currently hidden, table only)

---

### Users Table (`components/settings/user-management/UsersTable.tsx`) ⏳ PENDING

#### Sorting (2 columns)
- [ ] Sort by Email, Role

#### Filtering
- [ ] Email Filter: Text search
- [ ] Role Filter: Checkbox list

#### Table Columns
- [ ] Email: User icon + email
- [ ] Role: Badge OR inline editor
- [ ] Actions: 3-dot dropdown (right-aligned)

#### Inline Role Editing
- [ ] Edit Role → Shows Select dropdown
- [ ] Save/Cancel buttons
- [ ] Loading state

#### Actions Dropdown
- [ ] Edit Role (permission check)
- [ ] Delete User with dialog
- [ ] Hide actions for current user

#### Other
- [ ] No pagination (shows all users)
- [ ] Card wrapper with title + tooltip

---

## Component Architecture

```
components/ui/data-table/
├── DataTable.tsx              # Main component with TanStack Table
├── DataTablePagination.tsx    # Pagination footer
├── DataTableSelectionBar.tsx  # Multi-select actions bar
├── DataTableEmptyState.tsx    # Empty state component
├── DataTableSkeleton.tsx      # Loading skeleton
├── DataTableFilterSummary.tsx # "X filters active" bar
├── filters/
│   ├── TextFilter.tsx         # Text search + checkboxes
│   ├── CheckboxFilter.tsx     # Multi-select checkbox list
│   └── DateFilter.tsx         # Date range picker
├── types.ts                   # TypeScript interfaces
└── index.ts                   # Exports
```

---

## File Structure

### Created Files
```
components/ui/data-table/
├── DataTable.tsx           ✅ Created
├── DataTablePagination.tsx ✅ Created
├── DataTableSelectionBar.tsx ✅ Created
├── DataTableEmptyState.tsx ✅ Created
├── DataTableSkeleton.tsx   ✅ Created
├── DataTableFilterSummary.tsx ✅ Created
├── filters/
│   ├── TextFilter.tsx      ✅ Created
│   ├── CheckboxFilter.tsx  ✅ Created
│   └── DateFilter.tsx      ✅ Created
├── types.ts                ✅ Created
└── index.ts                ✅ Created
```

### Modified Files
```
app/charts/page.tsx         ✅ Migrated (~1450 → ~835 lines)
```

### Files To Modify
```
components/dashboard/dashboard-list-v2.tsx  ⏳ Pending (~2030 lines)
components/settings/user-management/UsersTable.tsx ⏳ Pending (~500 lines)
```

---

## Usage Examples

### Basic Usage (Charts Page Pattern)

```tsx
import {
  DataTable,
  ColumnHeader,
  ActionsCell,
  type ColumnDef,
  type SortState,
  type FilterState,
} from '@/components/ui/data-table';

// Define columns
const columns: ColumnDef<Chart>[] = [
  {
    id: 'title',
    accessorKey: 'title',
    header: () => (
      <ColumnHeader
        columnId="title"
        title="Name"
        sortable
        sortState={sortState}
        onSortChange={setSortState}
        filterConfig={filterConfigs.title}
        filterState={filterState}
        onFilterChange={setFilterState}
      />
    ),
    cell: ({ row }) => <CustomCellContent row={row.original} />,
    meta: { headerClassName: 'w-[35%]' },
  },
  // ... more columns
];

// Render DataTable - pass ALL filtered data, TanStack handles pagination internally
<DataTable
  data={filteredAndSortedData}  // Pass all data, not paginated slice
  columns={columns}
  isLoading={isLoading}
  getRowId={(row) => row.id}
  sortState={sortState}
  onSortChange={setSortState}
  filterState={filterState}
  onFilterChange={setFilterState}
  filterConfigs={filterConfigs}
  activeFilterCount={getActiveFilterCount()}
  onClearAllFilters={clearAllFilters}
  selection={isSelectionMode ? selectionConfig : undefined}
  pagination={{
    totalRows: filteredAndSortedData.length,
    initialPageSize: 10,
    pageSizeOptions: [10, 20, 50, 100],
  }}
  emptyState={emptyStateConfig}
  skeleton={skeletonConfig}
/>
```

### With Pinned Rows (Dashboard Pattern)

```tsx
// Separate pinned rows from regular data
const pinnedRows = dashboards.filter(d =>
  d.id === currentUser?.landing_dashboard_id ||
  d.id === currentUser?.org_default_dashboard_id
);
const regularRows = dashboards.filter(d => !pinnedRows.includes(d));

<DataTable
  data={regularRows}
  pinnedRows={pinnedRows}  // Pinned rows render first, not paginated
  // ... other props
/>
```

---

## Remaining Work

### Priority 1: Migrate Dashboard List
1. Read `dashboard-list-v2.tsx` thoroughly
2. Extract column definitions similar to charts
3. Handle pinned rows for landing page dashboards
4. Integrate share modal
5. Handle landing page API calls

### Priority 2: Migrate Users Table
1. Simpler migration (no pagination, no selection)
2. Handle inline role editing
3. Integrate DeleteUserDialog

### Priority 3: Enhancements
1. Update `DateFilter.tsx` to use `react-day-picker` for better UX
2. ~~Add TanStack Table's built-in pagination model~~ ✅ DONE
3. Consider virtual scrolling for large datasets
4. Add column visibility toggle (optional)

### Priority 4: Testing
1. Verify all filter types work correctly
2. Test pagination edge cases
3. Test selection mode and bulk actions
4. Test empty states and loading states
5. Cross-browser testing

---

## How to Continue

### Starting a New Session

1. **Read this document** to understand the context

2. **Check the current state**:
   ```bash
   # Verify DataTable components exist
   ls components/ui/data-table/

   # Check if charts page is migrated
   wc -l app/charts/page.tsx  # Should be ~835 lines
   ```

3. **Pick up where we left off**:
   - Dashboard list migration is next
   - Start by reading the full `dashboard-list-v2.tsx`
   - Create column definitions similar to `app/charts/page.tsx`

### Key Considerations for Dashboard Migration

1. **Pinned Rows**: Dashboards have "My Landing" and "Org Default" that must appear at top
2. **Share Modal**: External component that needs to be integrated
3. **Landing Page API**: Uses `useLandingPage` hook for set/remove landing page
4. **Grid/List Views**: Currently hidden (fixed to table), but code exists for future

### Commands

```bash
# Run dev server to test
npm run dev

# Type check
npx tsc --noEmit

# Check for DataTable-specific errors
npx tsc --noEmit 2>&1 | grep -E "data-table|charts/page"

# Lint
npm run lint
```

---

## References

- [TanStack Table Documentation](https://tanstack.com/table/v8/docs/introduction)
- [TanStack Table Pagination](https://tanstack.com/table/v8/docs/guide/pagination)
- [shadcn/ui Data Table](https://ui.shadcn.com/docs/components/data-table)
- [react-day-picker](https://react-day-picker.js.org/)

---

*Last Updated: November 28, 2024*
*Session: Charts page migration completed + TanStack pagination refactoring. Dashboard and Users pending.*
