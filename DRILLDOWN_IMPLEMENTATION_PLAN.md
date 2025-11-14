# Drill-Down Table Implementation Plan

## Current Problem
- User still sees X Axis/Y Axis configuration for drilldown chart type
- The chart type is not being properly recognized or is defaulting to wrong configuration
- Need a simpler, more straightforward implementation

## User Requirements (Clarified)

### What the user wants:
1. **A table that displays data with columns**
2. **ONE column can be designated as the "drill-down column"**
3. **When clicking on a value in that column:**
   - Filter the data by that value
   - Display filtered results
   - Show breadcrumb trail
   - Allow navigation back up

### Example Flow:
```
Initial Table:
state       | district      | revenue
------------|---------------|----------
California  | Los Angeles   | $500k
California  | San Diego     | $300k
Texas       | Houston       | $400k
Texas       | Dallas        | $350k

User clicks "California" in state column:

Breadcrumb: Home > California

Filtered Table:
state       | district      | revenue
------------|---------------|----------
California  | Los Angeles   | $500k
California  | San Diego     | $300k

User clicks "Los Angeles" in district column:

Breadcrumb: Home > California > Los Angeles

Filtered Table:
state       | district      | revenue
------------|---------------|----------
California  | Los Angeles   | $500k
```

## Root Cause Analysis

### Why current implementation isn't working:

1. **Type Definition Issue**:
   - TypeScript types may not include 'drilldown' in all places
   - Chart type selector may not be passing 'drilldown' correctly
   - URL parameter might not be updating to `type=drilldown`

2. **Conditional Rendering Issue**:
   - ChartBuilder.tsx has conditional: `formData.chart_type === 'drilldown'`
   - If formData.chart_type is not exactly 'drilldown', it falls through to default
   - Default shows X Axis/Y Axis configuration

3. **Component Loading Issue**:
   - SimpleDrillDownConfiguration might have import/compilation errors
   - Component might be failing to render silently

## Implementation Plan

### Phase 1: Diagnostic & Debug (15 minutes)
**Goal:** Understand why chart type isn't being recognized

#### Tasks:
1. ✅ Add console logging to track chart_type value
2. ✅ Add debug banner showing current chart type
3. ✅ Check URL parameters are being set correctly
4. ✅ Verify SimpleDrillDownConfiguration is importable

#### Success Criteria:
- Can see what chart_type value is being passed
- Can identify where the value is getting lost or changed

### Phase 2: Fix Chart Type Recognition (30 minutes)
**Goal:** Ensure 'drilldown' chart type flows correctly through the app

#### Tasks:
1. **Fix Chart Selection Page** (`app/charts/new/page.tsx`)
   - ✅ Add 'drilldown' to chartTypes array
   - ✅ Ensure it has proper icon (Layers) and color (cyan)
   - Verify onClick handler passes 'drilldown' correctly

2. **Fix Configure Page** (`app/charts/new/configure/page.tsx`)
   - Verify URL parameter parsing: `chartType = searchParams.get('type')`
   - Ensure formData initialization uses correct type
   - Add debug logging

3. **Fix ChartBuilder** (`components/charts/ChartBuilder.tsx`)
   - Verify conditional: `formData.chart_type === 'drilldown'`
   - Ensure SimpleDrillDownConfiguration is imported correctly
   - Add fallback error message if component fails

#### Success Criteria:
- Green debug banner appears when drilldown selected
- URL shows `type=drilldown`
- SimpleDrillDownConfiguration component renders

### Phase 3: Simplify Configuration Component (1 hour)
**Goal:** Create a working, simple drill-down configuration

#### Current Design:
```
SimpleDrillDownConfiguration:
1. Display Columns (checkboxes)
2. Drill-Down Column (dropdown)
3. Max Levels (number input)
4. Aggregation Columns (checkboxes)
```

#### Tasks:
1. **Verify Component Structure**
   - Check all imports are correct
   - Verify no TypeScript errors
   - Test component in isolation

2. **Simplify if Needed**
   - Remove max levels if not needed
   - Remove aggregation if complicating things
   - Focus on core functionality first

3. **Add Validation**
   - At least one display column selected
   - Drill-down column must be selected
   - Show helpful error messages

#### Success Criteria:
- Component renders without errors
- Can select display columns
- Can select drill-down column
- Configuration saves to formData

### Phase 4: Backend Integration (1 hour)
**Goal:** Ensure backend processes drill-down requests correctly

#### Current Backend Status:
- ✅ Endpoint exists: `POST /api/charts/{id}/data/`
- ✅ Accepts drill_down_level and drill_down_path
- ✅ Converts path to SQL filters
- ✅ Returns filtered data

#### Tasks:
1. **Update Backend to Accept Drill-Down Column**
   ```python
   # In extra_config:
   {
     "drill_down_column": "state",
     "table_columns": ["state", "district", "revenue"],
     "max_drill_levels": 3
   }
   ```

2. **Modify Query Builder**
   - When drill_down_path is provided, apply filters
   - Return data with all configured columns
   - No aggregation needed (just filtering)

3. **Test Backend Response**
   ```bash
   curl -X POST http://localhost:8002/api/charts/123/data/ \
     -H "Content-Type: application/json" \
     -d '{
       "drill_down_level": 1,
       "drill_down_path": [{"column": "state", "value": "California"}]
     }'
   ```

#### Success Criteria:
- Backend accepts drill_down_column in extra_config
- Returns filtered data based on drill_down_path
- No errors in backend logs

### Phase 5: Frontend Runtime Component (1.5 hours)
**Goal:** Create the table that handles drill-down interactions

#### Component: DrillDownTable (simplified)

**Responsibilities:**
1. Display table with configured columns
2. Make drill-down column clickable
3. Handle click → update filters
4. Show breadcrumb navigation
5. Handle drill-up (breadcrumb clicks)

**State Management:**
```typescript
interface DrillDownState {
  currentPath: Array<{ column: string; value: any }>;
  data: any[];
  isLoading: boolean;
}
```

**Key Functions:**
```typescript
// When user clicks a value in drill-down column
const handleDrillDown = (value: any) => {
  const newPath = [...currentPath, {
    column: drillDownColumn,
    value: value
  }];
  fetchData(newPath);
};

// When user clicks breadcrumb
const handleDrillUp = (index: number) => {
  const newPath = currentPath.slice(0, index + 1);
  fetchData(newPath);
};

// Fetch data with current filters
const fetchData = async (path) => {
  const response = await apiPost(`/api/charts/${chartId}/data/`, {
    drill_down_path: path,
    // ... other params
  });
  setData(response.data);
};
```

#### Tasks:
1. Update existing DrillDownTable component or create simpler version
2. Use configured drill_down_column from chart.extra_config
3. Make only that column clickable
4. Handle click events correctly
5. Update breadcrumb to show current path

#### Success Criteria:
- Table displays with configured columns
- Drill-down column is visually indicated (clickable style)
- Clicking filters data correctly
- Breadcrumb shows current position
- Can navigate back up hierarchy

### Phase 6: Integration & Testing (1 hour)
**Goal:** End-to-end testing of complete flow

#### Test Scenarios:

1. **Create New Drill-Down Chart**
   - Go to /charts/new
   - Select dataset
   - Select "Drill-Down Table" chart type
   - Configure display columns
   - Configure drill-down column
   - Save chart
   - View chart
   - Test drill-down interaction

2. **Edit Existing Chart**
   - Open existing drill-down chart
   - Modify drill-down column
   - Save changes
   - Verify changes work

3. **Edge Cases**
   - No data at drill-down level
   - Null values in drill-down column
   - Very deep hierarchies (5+ levels)
   - Special characters in values
   - Large datasets (pagination)

#### Success Criteria:
- All test scenarios pass
- No console errors
- Good performance (<500ms for drill-down)
- Intuitive UX

## Alternative Simpler Approach (If Above Fails)

### Option B: Use Existing Table Chart + Enhancement

Instead of new chart type, enhance existing "table" chart with optional drill-down:

1. **In table chart configuration:**
   - Add optional "Enable Drill-Down" toggle
   - When enabled, show drill-down column selector
   - Use same table component with enhanced functionality

2. **Benefits:**
   - Less code changes
   - Reuses existing table infrastructure
   - No new chart type needed
   - Simpler to maintain

3. **Implementation:**
   ```typescript
   // In table chart config:
   extra_config: {
     table_columns: [...],
     drill_down_enabled: true,  // New field
     drill_down_column: "state", // New field
     max_drill_levels: 3         // New field
   }
   ```

## Recommended Approach

**I recommend Option B (enhance existing table) because:**

1. ✅ Simpler - less moving parts
2. ✅ Reuses existing table component
3. ✅ Backend already supports it
4. ✅ Less confusion for users (one "table" concept)
5. ✅ Easier to maintain

**Implementation would be:**
1. Add drill-down toggle to SimpleTableConfiguration
2. When enabled, show drill-down column selector
3. Update TableChart component to handle clicks on drill-down column
4. Add breadcrumb component above table
5. Handle filter updates on click

This is the same logic but integrated into the existing table chart flow.

## Decision Point

**Before implementing, please confirm:**

1. **Do you want a separate "Drill-Down Table" chart type?**
   - OR enhance existing "Table" chart with optional drill-down?

2. **What should drill-down behavior be?**
   - Just filtering (show all rows matching filter)?
   - OR aggregation (show unique values with counts)?

3. **How many levels deep?**
   - Fixed (e.g., 3 levels)?
   - OR configurable (user sets max levels)?

4. **Should all columns be clickable for drill-down?**
   - OR just ONE designated column?

Please answer these questions so I can implement the correct solution efficiently.
