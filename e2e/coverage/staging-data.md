# Staging test data

Backend: `https://staging-api.dalgo.org` · Org: **Trial d05b1ddb faramir foundation** (slug `trial-d05b1ddb-faram`)

## Rules
- **Existing objects are read-only.** Tests may view/filter/export them but never edit, share-toggle, or delete.
- Every object a test creates is titled `e2e-<runId>-<name>` and deleted in teardown. A global sweeper removes stale `e2e-*` leftovers.

## Warehouse datasets (stable, use for create flows)
| Schema.table | Used by |
|---|---|
| `production.mart_education_program` | line, bar, map, table charts; education KPIs/metrics |
| `production.mart_health_menstrual_distribution` | map, pie, bar |
| `production.mart_health_child_development` | pivot_table, pie, line |
| `production.mart_health_maternal_risk` | table, pie, line |
| `production.mart_health_clinic_delivery` | pie, line |
| `production.mart_health_chatbot_operations` | pie, bar |

Avoid `public.dalgo_brain_*` (ad-hoc test charts, may change).

## Seed objects (read-only fixtures)
- **Dashboards:** 411 Health Sector Program Dashboard · 412 Education Program dashboard
- **Reports:** 150 Education Program Annual Review · 151 Health Sector Program Demo Report
- **KPIs:** 441–450 (education + health)
- **Metrics:** 619–627 (618 `asdfsdf` is junk — ignore)
- **Charts (27):** bar, line, pie, map, table, pivot_table present (IDs 1234–1260). No `number` chart in seed; create one in tests.
