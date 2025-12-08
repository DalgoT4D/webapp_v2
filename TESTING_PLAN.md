# Charts Module Testing Plan

**Goal**: Achieve comprehensive test coverage for the charts module with quality-first approach focusing on UI elements, user flows, and functionality.

**Coverage Target**: 60%+ overall (moderate approach, quality over quantity)

---

## Progress Overview

| Phase | Status | Files | Tests | Coverage |
|-------|--------|-------|-------|----------|
| Phase 0: Setup | ✅ Complete | 4 files | - | - |
| Phase 1: Utilities | 🔄 In Progress | 0/3 files | 0 tests | 0% |
| Phase 2: API Hooks | ⏳ Pending | 0/2 files | 0 tests | 0% |
| Phase 3: Components | ⏳ Pending | 0/5 files | 0 tests | 0% |
| Phase 4: Pages | ⏳ Pending | 0/4 files | 0 tests | 0% |

**Overall**: 0 test files, 0 tests written

---

## Phase 0: Infrastructure Setup ✅

**Status**: ✅ Complete

### Created Files
1. ✅ `__mocks__/echarts.ts` - Complete ECharts mock with all methods
2. ✅ `__mocks__/lib/api.ts` - API utility mocks with helpers
3. ✅ `__tests__/utils/test-helpers.tsx` - Custom render functions, auth/router mocks
4. ✅ `__tests__/utils/mock-data.ts` - Comprehensive fixture data

### Actions Taken
- ✅ Fixed `jest.config.ts` (import `next/jest.js`, added `testMatch` pattern)
- ✅ Deleted all old test directories (`tests/`, old `__tests__/`, `components/__tests__/`)
- ✅ Created fresh `__tests__/` structure: `lib/`, `hooks/api/`, `components/charts/`, `app/charts/`
- ✅ Excluded E2E Playwright tests from Jest runs

### Test Status
```bash
npm test
# 0 test suites, 0 tests - Clean slate ✅
```

---

## Phase 1: Critical Utilities

**Status**: 🔄 In Progress
**Target**: 85%+ coverage for utilities

### Files to Test

#### 1. `lib/chart-size-constraints.test.ts` 🔄 In Progress
**Priority**: HIGHEST (765 lines, most complex)

**Key Functions to Test**:
- `analyzeChartContent()` - 150+ lines of complex logic
- `getRowsAndColumns()` - Grid calculations
- `calculateOptimalChartSize()` - Size computation
- `getChartSizeClass()` - CSS class mapping

**Test Cases**:
- [ ] Analyze different chart types (bar, line, pie, map, table, number)
- [ ] Handle various data sizes (small, medium, large datasets)
- [ ] Calculate grid layout for different screen sizes
- [ ] Handle edge cases (empty data, null values, extreme sizes)
- [ ] Test size class mappings (small, medium, large, xlarge)

**Coverage Target**: 85%+

---

#### 2. `lib/chart-export.test.ts` ⏳ Pending
**Priority**: HIGH (269 lines, browser API usage)

**Key Functions to Test**:
- `exportChartToPNG()` - PNG export with html2canvas
- `exportChartToPDF()` - PDF export with jsPDF
- `downloadFile()` - File download trigger

**Test Cases**:
- [ ] Export chart as PNG (mock html2canvas)
- [ ] Export chart as PDF (mock jsPDF)
- [ ] Handle export errors gracefully
- [ ] Test filename generation
- [ ] Test different chart dimensions
- [ ] Mock canvas.toDataURL()

**Mocks Needed**:
```typescript
jest.mock('html2canvas');
jest.mock('jspdf');
```

**Coverage Target**: 80%+

---

#### 3. `lib/chart-title-utils.test.ts` ⏳ Pending
**Priority**: MEDIUM (string manipulation)

**Key Functions to Test**:
- `generateChartTitle()` - Title with filters/grouping
- `formatFilterForTitle()` - Filter display strings
- `truncateTitle()` - Title length limits

**Test Cases**:
- [ ] Generate title without filters
- [ ] Generate title with single filter
- [ ] Generate title with multiple filters
- [ ] Generate title with grouping
- [ ] Handle long titles (truncation)
- [ ] Handle special characters in titles

**Coverage Target**: 90%+

---

## Phase 2: API Hooks

**Status**: ⏳ Pending
**Target**: 75%+ coverage for hooks

### Files to Test

#### 1. `hooks/api/useChart.test.ts` ⏳ Pending
**Priority**: HIGH (28+ hooks, 600+ lines)

**Key Hooks to Test**:
- `useSchemas()` - Fetch available schemas
- `useTables(schema)` - Fetch tables for schema
- `useColumns(schema, table)` - Fetch columns
- `useChartData(payload)` - Generate chart data
- `useChart(id)` - Fetch single chart
- `useCharts(filters)` - Fetch chart list with filters
- `useCreateChart()` - Create new chart mutation
- `useUpdateChart(id)` - Update chart mutation
- `useDeleteChart(id)` - Delete chart mutation
- `useFavoriteChart(id)` - Toggle favorite
- `useTogglePublic(id)` - Toggle public status

**Test Cases**:
- [ ] Test successful data fetching with SWR
- [ ] Test loading states
- [ ] Test error states
- [ ] Test conditional fetching (when params are null)
- [ ] Test mutations (create, update, delete)
- [ ] Test mutation error handling
- [ ] Test cache revalidation after mutations
- [ ] Test filter query parameter building

**Mocks**:
```typescript
jest.mock('@/lib/api');
```

**Coverage Target**: 80%+

---

#### 2. `hooks/api/useCharts.test.ts` ⏳ Pending
**Priority**: MEDIUM

**Key Functionality**:
- Pagination logic
- Filter building
- Search functionality
- Sorting

**Test Cases**:
- [ ] Fetch charts with pagination
- [ ] Filter by chart_type
- [ ] Filter by is_public
- [ ] Filter by is_favorite
- [ ] Search by title/description
- [ ] Sort by created_at, updated_at, title
- [ ] Handle empty results

**Coverage Target**: 80%+

---

## Phase 3: Core Components

**Status**: ⏳ Pending
**Target**: 60%+ coverage for components

### Files to Test

#### 1. `components/charts/ChartPreview.test.tsx` ⏳ Pending
**Priority**: HIGH (chart rendering core)

**Component**: `ChartPreview`

**Props**:
```typescript
{
  config?: Record<string, any>;
  isLoading?: boolean;
  error?: any;
  onChartReady?: (chart: echarts.ECharts) => void;
  chartType?: string;
  tableData?: Record<string, any>[];
  onTableSort?: (column: string, direction: 'asc' | 'desc') => void;
}
```

**Test Cases - UI Elements**:
- [ ] Renders loading state with "Generating chart data..." text
- [ ] Renders error state with error message
- [ ] Renders empty state with "Configure your chart" message
- [ ] Renders chart canvas when data provided
- [ ] Shows chart metadata (data points count)

**Test Cases - Functionality**:
- [ ] Initializes ECharts instance on mount
- [ ] Updates chart when config changes
- [ ] Disposes chart instance on unmount
- [ ] Handles resize events
- [ ] Calls onChartReady callback
- [ ] Renders TableChart for table type

**Test Cases - Chart Types**:
- [ ] Renders bar chart correctly
- [ ] Renders line chart correctly
- [ ] Renders pie chart correctly
- [ ] Renders map chart correctly
- [ ] Renders number/gauge chart correctly

**Coverage Target**: 70%+

---

#### 2. `components/charts/ChartBuilder.test.tsx` ⏳ Pending
**Priority**: HIGH (main creation flow)

**Component**: `ChartBuilder`

**Test Cases - UI Elements**:
- [ ] Displays chart type selection options (all 16 types)
- [ ] Shows computation type radio buttons (raw/aggregated)
- [ ] Displays schema dropdown
- [ ] Displays table dropdown
- [ ] Shows column configuration fields
- [ ] Shows chart preview area
- [ ] Displays save/cancel buttons

**Test Cases - User Flow**:
- [ ] Select chart type → shows next step
- [ ] Select schema → loads tables
- [ ] Select table → loads columns
- [ ] Configure axes → generates preview
- [ ] Fill title → enables save button
- [ ] Click save → calls onSave callback
- [ ] Click cancel → calls onCancel callback

**Test Cases - Data Processing**:
- [ ] Switches between raw/aggregated correctly
- [ ] Shows appropriate fields for raw data
- [ ] Shows appropriate fields for aggregated data
- [ ] Validates required fields

**Coverage Target**: 65%+

---

#### 3. `components/charts/MapPreview.test.tsx` ⏳ Pending
**Priority**: MEDIUM

**Test Cases**:
- [ ] Renders map with geographic data
- [ ] Handles drill-down navigation
- [ ] Shows correct region hierarchy
- [ ] Handles click events on regions
- [ ] Displays tooltips on hover

**Coverage Target**: 60%+

---

#### 4. `components/charts/ChartDataConfigurationV3.test.tsx` ⏳ Pending
**Priority**: MEDIUM

**Test Cases - UI Elements**:
- [ ] Shows dataset selector dropdown
- [ ] Displays schema/table selection
- [ ] Shows column selection dropdowns
- [ ] Renders metrics configuration
- [ ] Shows add metric button

**Test Cases - Functionality**:
- [ ] Loads columns when table selected
- [ ] Updates metrics array
- [ ] Validates metric configuration
- [ ] Auto-prefills with default values

**Coverage Target**: 55%+

---

#### 5. `components/charts/ChartFiltersConfiguration.test.tsx` ⏳ Pending
**Priority**: MEDIUM

**Test Cases - UI Elements**:
- [ ] Shows "Add Filter" button
- [ ] Renders filter rows
- [ ] Displays column dropdown
- [ ] Shows operator dropdown
- [ ] Shows value input field
- [ ] Displays delete filter button

**Test Cases - Functionality**:
- [ ] Adds new filter row
- [ ] Updates filter values
- [ ] Removes filter row
- [ ] Validates filter completeness
- [ ] Handles different operators (=, !=, >, <, in, etc.)

**Coverage Target**: 55%+

---

## Phase 4: Page Components

**Status**: ⏳ Pending
**Target**: 50%+ coverage for pages

### Files to Test

#### 1. `app/charts/page.test.tsx` ⏳ Pending
**Priority**: HIGH (list view, 300+ lines)

**Test Cases - UI Elements**:
- [ ] Displays "Charts" heading
- [ ] Shows "Create Chart" button
- [ ] Renders chart cards/table
- [ ] Shows search input
- [ ] Displays filter options (type, public, favorite)
- [ ] Shows pagination controls
- [ ] Displays empty state when no charts

**Test Cases - User Flow**:
- [ ] Click "Create Chart" → navigates to /charts/new
- [ ] Click chart card → navigates to /charts/[id]
- [ ] Search by title → filters charts
- [ ] Filter by type → updates list
- [ ] Toggle favorite → updates chart
- [ ] Delete chart → removes from list
- [ ] Paginate → loads more charts

**Test Cases - Data Loading**:
- [ ] Shows loading skeleton
- [ ] Displays error message on failure
- [ ] Loads charts on mount
- [ ] Revalidates after mutations

**Coverage Target**: 55%+

---

#### 2. `app/charts/[id]/ChartDetailClient.test.tsx` ⏳ Pending
**Priority**: HIGH (detail view client logic)

**Test Cases - UI Elements**:
- [ ] Displays chart title
- [ ] Shows chart description
- [ ] Renders chart preview
- [ ] Shows "Edit" button
- [ ] Shows "Delete" button
- [ ] Shows "Export" dropdown (PNG, PDF)
- [ ] Displays "Favorite" toggle
- [ ] Shows "Public" toggle
- [ ] Displays creator info
- [ ] Shows created/updated timestamps

**Test Cases - User Actions**:
- [ ] Click "Edit" → navigates to edit page
- [ ] Click "Delete" → shows confirmation modal
- [ ] Confirm delete → deletes chart and redirects
- [ ] Click "Export PNG" → downloads PNG
- [ ] Click "Export PDF" → downloads PDF
- [ ] Toggle favorite → updates state
- [ ] Toggle public → updates state

**Coverage Target**: 55%+

---

#### 3. `app/charts/new/page.test.tsx` ⏳ Pending
**Priority**: MEDIUM (create flow)

**Test Cases**:
- [ ] Renders ChartBuilder component
- [ ] Passes correct props
- [ ] Handles successful save → redirects to chart detail
- [ ] Handles cancel → navigates back
- [ ] Shows loading state during save

**Coverage Target**: 50%+

---

#### 4. `app/charts/[id]/edit/page.test.tsx` ⏳ Pending
**Priority**: MEDIUM (edit flow)

**Test Cases**:
- [ ] Loads existing chart data
- [ ] Pre-fills ChartBuilder with chart config
- [ ] Handles successful update → redirects to chart detail
- [ ] Handles cancel → navigates back
- [ ] Shows loading state during update

**Coverage Target**: 50%+

---

## Testing Guidelines

### UI Testing Focus
- ✅ Test that all visible elements are present
- ✅ Use accessible queries (getByRole, getByLabelText, getByText)
- ✅ Test user interactions (click, type, select)
- ✅ Verify navigation and routing

### Functionality Testing Focus
- ✅ Test API calls are made correctly
- ✅ Test data transformations
- ✅ Test error handling
- ✅ Test loading states
- ✅ Test edge cases (empty data, null values)

### Mock Strategy
- ✅ Mock external APIs (`@/lib/api`)
- ✅ Mock SWR with custom provider
- ✅ Mock ECharts for chart components
- ✅ Mock Next.js navigation (`useRouter`, `usePathname`)
- ✅ Mock auth store (`useAuthStore`)

### Test Structure
```typescript
describe('ComponentName', () => {
  describe('UI Elements', () => {
    it('should render all buttons and inputs', () => {
      // Test UI rendering
    });
  });

  describe('User Interactions', () => {
    it('should handle button click', async () => {
      // Test user actions
    });
  });

  describe('Data Loading', () => {
    it('should show loading state', () => {
      // Test loading states
    });
  });

  describe('Error Handling', () => {
    it('should display error message', () => {
      // Test error states
    });
  });
});
```

---

## Running Tests

### Commands
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- __tests__/lib/chart-size-constraints.test.ts

# Run tests matching pattern
npm test -- --testNamePattern="ChartPreview"
```

### Coverage Reports
Coverage reports are generated in `coverage/` directory.

View HTML report: `open coverage/lcov-report/index.html`

---

## Notes

- **Quality over Quantity**: Focus on meaningful tests that catch real bugs
- **User-Centric**: Test from user's perspective (what they see and do)
- **Maintainable**: Keep tests simple and clear
- **Fast**: Mock external dependencies to keep tests fast
- **Isolated**: Each test should be independent

---

## Session Log

### Session 1 - [Date]
- ✅ Created mock infrastructure
- ✅ Cleaned up old tests
- ✅ Set up fresh test structure
- 🔄 Started Phase 1: Utilities

**Next Session**: Continue Phase 1 utilities, then move to Phase 2 API hooks.
