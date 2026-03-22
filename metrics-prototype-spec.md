# Prototype Spec: My Metrics — Art of the Possible Spike

**Date:** 23 March 2026
**Author:** Abhishek (PM)
**Type:** Experiment (Lifecycle Stage 2: Sketch)
**Strategic purpose:** Functionality Richness — demonstrates the core storytelling loop

---

## Context

Dalgo is transforming from a data pipeline tool into a programme monitoring platform for NGOs. The central concept is a "semantic layer" — a configuration file that defines an NGO's programme metrics with targets, and powers every surface in the platform (dashboards, reports, alerts, chat).

This prototype demonstrates the concept using Noora Health's Care Companion Program (CCP) — a maternal and newborn health programme operating across facilities in multiple Indian states.

The audience is the Dalgo team + CEO. The goal is to make the self-reinforcing system tangible: one configuration → multiple surfaces → each surface enriched by the others.

---

## Personas

**Ananya** — M&E Lead at Noora Health. She tracks 6 CCP indicators across states. Currently uses spreadsheets to prepare for monthly programme review meetings. She knows her metrics intimately but spends hours assembling them into presentable formats.

**The team watching the demo** — They need to see: (1) this is built on the real Dalgo codebase, not a mockup, (2) the semantic layer concept is real and practical, (3) the metric → chart → annotation → evidence flow works as a system.

---

## User Journey — 3 Screens

### Screen 1: Semantic Layer Configuration
**Route:** `/experiments/metrics/setup`
**Purpose:** Show what powers everything. One config, every surface.

**Layout:**
- Page follows existing Dalgo layout pattern: fixed header + scrollable content
- Header: Title "Metric Configuration", subtitle "Care Companion Program · Noora Health · Semantic Layer Preview"
- Two-column layout below the header:
  - **Left column (60% width):** A code editor showing YAML configuration
  - **Right column (40% width):** A live preview panel showing how the YAML translates to metric cards

**The YAML editor:**
- Use a `<textarea>` or `<pre>` with a monospace font, styled to look like a code editor (dark background, syntax-like colouring is nice-to-have but not essential — a clean monospace display is fine)
- Pre-populated with the full Noora Health CCP configuration (see Data section below)
- The user can edit the YAML text directly
- Below the editor: a "Preview My Metrics →" button (primary style) that navigates to Screen 2

**The live preview panel:**
- Title: "Preview" in muted text
- Shows a compact summary: number of metrics detected, how many would be green/amber/red based on current values vs targets
- Shows a mini version of the first 2-3 metric cards (just name + current + target + RAG badge) as a preview of what Screen 2 will look like
- This panel updates as the YAML is edited (parse on change with error tolerance — if the YAML is malformed, just show the last valid state)

**Why this screen matters for the demo:**
The team sees that changing a target value in the config immediately changes the RAG status in the preview. This makes the "single source of truth" concept visceral, not abstract. Erica sees the consultant's configuration experience.

---

### Screen 2: My Metrics Dashboard
**Route:** `/experiments/metrics`
**Purpose:** The M&E lead's daily view. Programme health at a glance.

**Layout:**
- Fixed header + scrollable content (matching existing Dalgo page pattern)
- Header section:
  - Title: "My Metrics" (`text-3xl font-bold`)
  - Subtitle: "Care Companion Program · Noora Health" (`text-muted-foreground`)
  - Right side of header: "Last updated: 23 March 2026" in muted text
  - Below the title row: a subtle link "View configuration →" that navigates back to Screen 1

**Summary bar** (below header, before the grid):
- A row of 4 compact stat indicators using Card components
- Each shows: a large number + a label
  - "6" — "Total Indicators" (neutral colour)
  - "2" — "On Track" (green: `text-emerald-600`, `bg-emerald-50`)
  - "4" — "At Risk" (amber: `text-amber-600`, `bg-amber-50`)
  - "0" — "Below Target" (red: `text-red-600`, `bg-red-50`)
- These counts must be computed from the actual metric data, not hardcoded

**Filter tabs** (below summary bar):
- A row of filter buttons: All | On Track | At Risk | Below Target
- Use existing Button component with variant="outline" for inactive, variant="default" for active
- Filtering updates the grid below in real-time
- Show count in each tab: "All (6)" "On Track (2)" etc.

**Metrics grid:**
- `grid grid-cols-1 md:grid-cols-2 gap-4`
- Each card uses the Card component from `components/ui/card`
- Card contents (top to bottom):
  1. **Top row:** Category badge on the left (e.g., "OUTCOME" — small, muted, uppercase, `text-xs font-medium tracking-wide text-muted-foreground`) and RAG badge on the right using Badge component:
     - On Track: green variant or custom `bg-emerald-50 text-emerald-700 border-emerald-200`
     - At Risk: `bg-amber-50 text-amber-700 border-amber-200`
     - Below Target: `bg-red-50 text-red-700 border-red-200`
  2. **Metric name:** `text-base font-semibold` with normal line-height for wrapping
  3. **Value row:** Large current value (`text-2xl font-bold`) with unit, and a sparkline SVG on the right side of the same row
  4. **Target comparison:** Below the value: "vs target 90%" in `text-sm text-muted-foreground`
  5. **Progress bar:** A thin horizontal bar showing progress from baseline to target. Use a simple `div` with `bg-muted` background and a coloured fill `div` inside. Colour matches RAG. Below the bar: "Baseline: 62%" on the left, "Target: 90%" on the right in `text-xs text-muted-foreground`
  6. **Annotation** (conditional): If the metric has an annotation, show it at the bottom of the card in a subtle container: `bg-muted/50 rounded-md p-3 text-sm` with a left border accent (`border-l-2 border-blue-400`). Prefix with bold "Context:" label.

**Sparkline specification:**
- Pure SVG, no library dependency
- Width: 100px, Height: 32px
- Polyline of the 6 trend data points
- Stroke colour matches RAG status (emerald-500 / amber-500 / red-500)
- Stroke width: 2px, rounded line caps
- Area fill below the line with 10% opacity of the same colour
- Small filled circle on the final data point

**Card interaction:**
- Cards are clickable (full card is the click target, `cursor-pointer`)
- Hover state: subtle shadow increase and border colour change to match RAG colour
- Click navigates to `/experiments/metrics/[id]` where id matches the metric's id

---

### Screen 3: Metric Detail View
**Route:** `/experiments/metrics/[id]`
**Purpose:** Deep dive into one metric. The content that would flow into operational reports.

**Layout:**
- Fixed header + scrollable content
- Header:
  - Back link: "← Back to My Metrics" (text button or link, navigates to Screen 2)
  - Title: The metric name (`text-2xl font-bold`)
  - Subtitle row: Category badge + RAG badge + "Last updated: 23 March 2026"

**Key figures row** (below header):
- Three Card components side by side:
  - "Current Value" — large number (the current value + unit), with a small up/down trend arrow compared to previous period
  - "Target" — the target value + unit
  - "Baseline" — the baseline value + unit
- The current value card has a left border matching RAG colour

**Trend chart section:**
- Section title: "Trend — 6 Month View" (`text-lg font-semibold`)
- Use ECharts (Apache ECharts — check if `echarts` or `echarts-for-react` is in package.json; if not, use a simple SVG chart instead)
- Chart specifications:
  - Line chart, 6 data points
  - X-axis: month labels (Oct, Nov, Dec, Jan, Feb, Mar)
  - Y-axis: auto-scaled with unit suffix
  - Data line: solid, 2.5px, coloured by RAG status
  - Target line: horizontal dashed line at the target value, labelled "Target: X%", in a neutral grey
  - Area fill below the data line at 10% opacity
  - Data point dots on each value
  - Clean grid, no chart border, white background
  - Title above the chart: the metric name
  - Tooltip on hover showing the exact value for each month
- Chart container: Card component, padded, minimum height ~300px

**Contextual annotation section:**
- Section title: "Contextual Annotation" (`text-lg font-semibold`)
- Subtitle: "Why is this metric where it is? Your team's explanation." (`text-sm text-muted-foreground`)
- A `<textarea>` pre-filled with the annotation text (if it exists) or placeholder: "Add context for this period — what happened, what changed, what's being done..."
- The textarea should look editable (it IS editable in-memory)
- Character count or subtle "Saves to this session" note in muted text below
- Styled inside a Card component

**Curated evidence section:**
- Section title: "Evidence from the Field" (`text-lg font-semibold`)
- Subtitle: "Voices from beneficiaries and field teams" (`text-sm text-muted-foreground`)
- If the metric has an evidence quote:
  - Display in a styled quote card: large opening quote mark (decorative), the quote text in `text-base italic`, attribution line below ("— Beneficiary, Karnataka" in `text-sm text-muted-foreground`)
  - Background: slightly tinted card (e.g., `bg-blue-50/50`)
- If no evidence: show a placeholder card with dashed border: "Select a quote from survey data to attach to this metric"
- Below the quote card: a disabled button "Browse survey responses →" (shows the concept exists even though it's not built yet)

**What connects to reports (visual hint, not functional):**
- At the bottom of the page, a subtle banner/card:
  - Icon or illustration suggesting a document
  - Text: "This metric section — chart, annotation, and evidence — would assemble into the operational report for the CCP monthly review."
  - A disabled button: "Preview in Report →"
  - This is a narrative bridge to the team — shows them what comes next without building it

---

## Data: Noora Health CCP Metrics

### YAML Configuration (Screen 1)

```yaml
programme:
  name: Care Companion Program
  organisation: Noora Health
  period: Q4 FY26 (October 2025 — March 2026)
  last_updated: "2026-03-23"

metrics:
  - id: 1
    name: Caregiver Training Completion Rate
    category: Outcome
    unit: "%"
    direction: higher-is-better
    baseline: 62
    target: 90
    current: 87
    trend: [62, 68, 74, 79, 83, 87]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: >
      Slight dip in Karnataka due to facility audit
      schedule changes in February.
    evidence:
      quote: >
        Since the health centre moved, I have to walk
        45 minutes with my child. Sometimes I just don't go.
      source: Beneficiary, Karnataka

  - id: 2
    name: Newborn Readmission Rate (30-day)
    category: Outcome
    unit: "%"
    direction: lower-is-better
    baseline: 12.5
    target: 8
    current: 4.2
    trend: [12.5, 10.1, 8.3, 6.7, 5.1, 4.2]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: null
    evidence: null

  - id: 3
    name: Skin-to-Skin Care Adoption
    category: Output
    unit: "%"
    direction: higher-is-better
    baseline: 51
    target: 85
    current: 78
    trend: [51, 58, 65, 72, 76, 78]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: >
      Three facilities in Karnataka paused training
      during monsoon facility closures in July-August.
    evidence:
      quote: >
        Before the training, we didn't know that skin contact
        helps the baby stay warm. Now we do it right after birth.
      source: Nurse, District Hospital, Tamil Nadu

  - id: 4
    name: Breastfeeding Initiation (within 1 hr)
    category: Output
    unit: "%"
    direction: higher-is-better
    baseline: 58
    target: 80
    current: 83
    trend: [58, 64, 70, 75, 80, 83]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: null
    evidence: null

  - id: 5
    name: Cord Care Practice Adoption
    category: Output
    unit: "%"
    direction: higher-is-better
    baseline: 44
    target: 75
    current: 71
    trend: [44, 50, 56, 62, 67, 71]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: >
      Improving trend. New training materials deployed
      in January showing early results.
    evidence:
      quote: >
        The pictorial guide made it easy to explain to mothers.
        They understand better when they can see the steps.
      source: Health Worker, Uttar Pradesh

  - id: 6
    name: Facilities Active (CCP Training)
    category: Activity
    unit: ""
    direction: higher-is-better
    baseline: 180
    target: 250
    current: 237
    trend: [180, 195, 208, 218, 228, 237]
    trend_labels: [Oct, Nov, Dec, Jan, Feb, Mar]
    annotation: null
    evidence: null
```

### RAG Status Calculation Logic

```
For direction: higher-is-better:
  - Green (On Track): current >= target
  - Red (Below Target): current < target * 0.8
  - Amber (At Risk): everything else

For direction: lower-is-better:
  - Green (On Track): current <= target
  - Red (Below Target): current > target * 1.2
  - Amber (At Risk): everything else
```

RAG status is COMPUTED from the data, never hardcoded. If someone edits the YAML and changes a target, the RAG status changes.

---

## Technical Requirements

### File structure
```
app/
  experiments/
    metrics/
      page.tsx              — Screen 2: My Metrics dashboard
      setup/
        page.tsx            — Screen 1: YAML configuration
      [id]/
        page.tsx            — Screen 3: Metric detail view
    _lib/
      metrics-data.ts       — Shared state: default YAML, parser, React context
      yaml-parser.ts        — Simple YAML parser (or use a lightweight library)
```

### Integration requirements
- Add `/experiments` as a public route prefix in `components/client-layout.tsx` (alongside `/login`, `/share/dashboard`)
- Use existing UI components: Card, CardContent, CardHeader from `components/ui/card`; Badge from `components/ui/badge`; Button from `components/ui/button`; Tabs/TabsList/TabsTrigger if available
- Use Tailwind CSS classes consistent with the existing app
- Follow the page layout pattern: outer `div` with `h-full flex flex-col`, fixed header with `flex-shrink-0 border-b bg-background`, scrollable content with `flex-1 overflow-y-auto p-6`
- Check if `echarts` or `echarts-for-react` is in `package.json`. If yes, use it for the trend chart. If no, use a well-styled SVG chart instead. Do NOT add new npm dependencies without telling me.

### State management
- Use React Context to share the parsed metric data across all 3 screens
- Default state: the 6 Noora Health metrics parsed from the default YAML
- When the user edits YAML on Screen 1 and clicks "Preview My Metrics →", the parsed data updates in context and they navigate to Screen 2
- In-memory only. Refresh = reset to defaults. This is fine.

### What NOT to do
- Do NOT modify any existing Dalgo pages, components, or routes
- Do NOT add the experiments pages to the sidebar navigation
- Do NOT add new npm dependencies without asking
- Do NOT build a full YAML parser — a simple key-value parser that handles this specific structure is fine, or use `js-yaml` if it's already in the project
- Do NOT implement real persistence, API calls, or backend integration
- Keep all experiment code under `app/experiments/` and `app/experiments/_lib/` so it's cleanly isolated

---

## Edge Cases to Handle

### YAML parsing (Screen 1)
- **Invalid YAML:** If the user types something unparseable, do NOT crash or show a blank screen. Show a subtle inline warning: "Configuration has a syntax issue — showing last valid state" in `text-amber-600` below the editor. Continue displaying the last successfully parsed data everywhere.
- **Metric removed from YAML:** If the user deletes a metric from the YAML, Screens 2 and 3 should handle fewer than 6 metrics gracefully. The grid should not break or show empty card slots.
- **Empty YAML:** If the user clears all content, show an empty state on Screen 2: "No metrics configured. Go to configuration to define your programme metrics."

### Lower-is-better metrics (critical)
- **Newborn Readmission Rate** has `direction: lower-is-better`. Current (4.2) is below target (8), which is GOOD — this must show as green/On Track. The progress bar must invert: progress = how far DOWN from baseline (12.5) toward target (8). Baseline on the left, target on the right, bar fills left-to-right as the value decreases. Test this metric specifically — if this one is wrong, the demo loses credibility.

### Empty units
- **Facilities Active** has `unit: ""`. Display must handle this cleanly — show "237" not "237%" and not "237 ". No trailing space or dangling unit character.

### Navigation
- **Direct URL access:** If someone navigates to `/experiments/metrics` directly (without going through setup), it must work using the default 6 metrics. Setup is optional, not a prerequisite. The YAML editing enriches the demo but the dashboard must stand on its own.
- **Invalid metric ID:** If someone navigates to `/experiments/metrics/99`, show a clean "Metric not found" message with a "← Back to My Metrics" link. No crash, no blank page.
- **Back button consistency:** Back link on the detail view (Screen 3) must use Next.js `<Link>` or `router.push` to go to `/experiments/metrics`, not `router.back()`. Browser back could go to setup or an external page.

### Display and responsiveness
- **Long metric names:** "Breastfeeding Initiation (within 1 hr)" is 38 characters. Cards must wrap this gracefully without breaking layout. Set a consistent card height or allow natural height variation — do NOT use fixed heights that truncate text.
- **Projector/screen share resolution:** The demo will likely be shown on a projector or screen share. The `md:grid-cols-2` breakpoint should be set so that 2 columns show at reasonable widths (768px+). Below that, single column. Test at 1024px width as a realistic projector scenario.
- **Sparkline with decreasing trend:** The Newborn Readmission Rate trend goes DOWN (12.5 → 4.2), which is good. The sparkline should still look "positive" — green colour, upward visual momentum is not required. Just ensure the line renders correctly for decreasing data.

### State persistence within session
- **Annotation edits:** If the user edits an annotation on Screen 3, navigates back to Screen 2, then returns to the same metric, the edit must persist. Use React Context for this, not component-local state.
- **Filter state:** If the user selects "At Risk" filter on Screen 2, navigates to a detail view and back, the filter can reset to "All". This is acceptable — don't over-engineer filter persistence.

### Chart (Screen 3)
- **ECharts dependency:** Before using ECharts, check if `echarts` or `echarts-for-react` is in `package.json`. If it IS present, use it. If it is NOT present, build a well-styled SVG chart instead. Do NOT add a new npm dependency without telling me first.
- **Chart on lower-is-better metrics:** The target line for Newborn Readmission Rate should be at 8% (above the current value line at 4.2%). The trend line going down should still render clearly with proper Y-axis scaling.

---

## Acceptance Criteria

1. User can view YAML configuration at `/experiments/metrics/setup` and see a live preview of metric cards
2. User can edit the YAML, change a target value, and see the RAG status update in the preview
3. User can click "Preview My Metrics →" and see the full dashboard at `/experiments/metrics`
4. Dashboard shows 6 metric cards with correct RAG status, sparklines, progress bars, and annotations
5. User can filter metrics by RAG status
6. User can click any metric card and navigate to the detail view
7. Detail view shows a professional trend chart with target line
8. Detail view shows the annotation (editable) and evidence quote
9. Back navigation works from detail → dashboard → setup
10. All 3 screens use existing Dalgo UI components and Tailwind patterns
11. The prototype is accessible at the routes without logging in

---

## What we'll narrate at the demo (not built)

- "Imagine clicking 'Generate Report' and this metric section — chart, annotation, evidence — assembles into the operational report"
- "Imagine sharing that report and the programme director seeing a clean viewer experience with no admin clutter"
- "Now imagine swapping this YAML for Baala's menstrual health metrics — same platform, different programme"
- "The consultant configures the YAML during bootcamp. The M&E lead sees the metrics page. The programme director sees the report. One source of truth, three experiences."
