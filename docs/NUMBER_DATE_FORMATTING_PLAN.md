# Number & Date Formatting Enhancement Plan

## Goal
Add new number format presets, Indian/International number system, and date formatting options to Dalgo charts.

---

## Formatting Approach (Like Superset)

### Current Dalgo Approach ❌
```
Backend → applies formatting → sends formatted echarts_config
Frontend → just renders what backend sent
Problem: Can't preview format changes without saving & refetching
```

### New Approach (Like Superset) ✅
```
Backend → sends RAW values (12345.432)
Frontend → applies formatting → displays "12.3k" or "₹1,00,000"
Benefit: Instant format preview, no API calls needed
```

**Why Frontend Formatting?**
- User can change format and see preview **instantly**
- No need to save chart to see different formats
- Better UX - try different formats without waiting
- Same approach used by Superset

---

## Current State

### Number Chart
**Already has:**
- 4 formats: Default, Comma Separated, Percentage, Currency
- Decimal Places selector
- Prefix/Suffix inputs
- ⚠️ Formatting done by backend (need to change to frontend)

**Missing:**
- Indian number system
- SI notation formats (.1s, .3s)
- Adaptive formatting
- Frontend formatter utility

### Table Chart
- **Has**: Column selection only
- **Missing**: Column formatting not available in UI

### Date Formatting
- **Has**: Nothing (only browser default)
- **Missing**: Date format patterns

---

## Target State

### Number Formats

**Keep existing:**
| Format | Example |
|--------|---------|
| Default | 12345.432 (same as original value) |
| Comma Separated | 1,234 |
| Percentage | 12% |
| Currency | $1,234 |

**Add new:**
| Format | Example | Description |
|--------|---------|-------------|
| Adaptive | Auto | Smart formatting based on value size |
| ,d | 12,345 | Comma separated integer (no decimals) |
| .1s | 10k | SI notation - 1 digit (K, M, G) |
| .3s | 12.3k | SI notation - 3 digits (K, M, G) |

**Add Number System option:**
| System | Example (10000000) |
|--------|-------------------|
| International | 10,000,000 |
| Indian | 1,00,00,000 |

**Keep existing:**
- Decimal Places selector ✅
- Prefix input ✅
- Suffix input ✅

---

### Date Formats to Add
| Format | Example |
|--------|---------|
| DD/MM/YYYY | 14/01/2019 |
| MM/DD/YYYY | 01/14/2019 |
| YYYY-MM-DD | 2019-01-14 |
| YYYY-MM-DD HH:MM:SS | 2019-01-14 10:30:00 |
| DD-MM-YYYY HH:MM:SS | 14-01-2019 10:30:00 |
| HH:MM:SS | 01:32:10 |

---

## How It Will Look in Dalgo

### Number Chart
```
Number Format: [Dropdown ▼]
┌────────────────────────────────┐
│ Default                        │
│ Comma Separated (1,234)        │
│ Percentage (12%)               │
│ Currency ($1,234)              │
│ ─────────────────────────────  │
│ Adaptive (auto)           NEW  │
│ ,d (12,345)               NEW  │
│ .1s (10k)                 NEW  │
│ .3s (12.3k)               NEW  │
└────────────────────────────────┘

Number System: [Indian ▼] / [International ▼]  ← NEW

Decimal Places: [2 ▼]        ← Already exists
Prefix: [₹________]          ← Already exists
Suffix: [crores___]          ← Already exists

Preview: ₹1,00,00,000.00 crores  ← Instant preview (no API call)
```

### Table Chart - Date Column
```
Column: created_at
├── Date Format: [DD/MM/YYYY ▼]
└── Preview: 14/01/2019
```

---

## Where Formats Apply

| Chart Type | Number Format | Date Format |
|------------|---------------|-------------|
| Number Chart | ✅ Main value | ❌ N/A |
| Table Chart | ✅ Number columns | ✅ Date columns |
| Bar/Line Chart | ✅ Y-axis, tooltips | ✅ X-axis (if date dimension) |
| Pie Chart | ✅ Values | ✅ Labels (if date dimension) |

---

## Tasks

### Backend
- Ensure API returns **raw numeric values** (not pre-formatted)
- Store format preferences in `extra_config.customizations` (already works)

### Frontend

1. **Create formatter utility** (`lib/formatters.ts`)
   - `formatNumber(value, options)` - handles all number formats
   - `formatDate(value, format)` - handles all date formats
   - Indian/International number system support
   - SI notation formatter (.1s, .3s)
   - All formatting happens on frontend for instant preview

2. **Update Number Chart UI** (`NumberChartCustomizations.tsx`)
   - Add new format options to dropdown (Adaptive, ,d, .1s, .3s)
   - Add Number System dropdown (Indian/International)
   - Add instant preview using formatter utility

3. **Update Chart Rendering**
   - Apply formatting in chart components using `lib/formatters.ts`
   - Number Chart: format the main displayed value
   - Bar/Line/Pie: format tooltips and labels

4. **Integrate Table Column Formatting**
   - Wire up `TableConfiguration.tsx` in ChartBuilder (currently not used)
   - Add date format dropdown for date columns
   - Use `lib/formatters.ts` for consistent formatting

5. **Testing**
   - Unit tests for all formatter functions
   - Test Indian/International number formatting
   - Test SI notation edge cases
   - Test date formatting with different timezones

---

## Questions for Team

1. **Table formatting** - Should we use existing `TableConfiguration.tsx` or add formatting to `SimpleTableConfiguration.tsx`?

2. **Date timezone** - Use browser timezone or allow configuration?

3. **Backend check** - Confirm backend sends raw values for number charts (or needs update)
