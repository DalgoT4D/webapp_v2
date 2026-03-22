/**
 * Default Noora Health CCP metrics configuration.
 * Used when no custom YAML has been loaded.
 */
export const DEFAULT_METRICS_YAML = `programme:
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
`;
