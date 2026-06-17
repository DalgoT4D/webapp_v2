---
description: Data ingestion domain map — Airbyte sources, connections, connectors, and warehouse setup.
paths:
  - "components/ingest/**"
  - "components/connections/**"
  - "components/connectors/**"
  - "app/ingest/**"
  - "hooks/api/useConnections.ts"
  - "hooks/api/useSources.ts"
  - "hooks/api/useWarehouse.ts"
  - "types/connections.ts"
  - "types/source.ts"
  - "types/warehouse.ts"
---

# Ingest — Domain Map

Airbyte-based ingestion: configure **sources** → create **connections** (source→warehouse) → **sync**. Sync execution runs through Prefect (`rules/pipeline.md`).

## Where things live

| Concern | Location |
|---|---|
| Ingest page (entry, tabs) | `app/ingest/page.tsx` (connections / sources / warehouse) |
| Connections list / form / history | `components/connections/{connections-list,connection-form,connection-sync-history}.tsx` |
| Schema changes | `components/connections/{pending-actions,schema-change-form}.tsx` |
| Sources list / form | `components/ingest/sources/{SourceList,SourceForm}.tsx` |
| Warehouse display / setup | `components/ingest/warehouse/{warehouse-display,warehouse-form}.tsx` |
| Connector config (JSON-Schema → form) | `components/connectors/{ConnectorConfigForm,spec-parser}.ts(x)` |
| Hooks | `hooks/api/useConnections.ts`, `useSources.ts`, `useWarehouse.ts` |
| Types | `types/connections.ts` (`Connection`, `SyncCatalog`, `SourceStream`, `SchemaChange`), `source.ts`, `warehouse.ts` |
| Constants | `constants/connections.ts` (`SyncMode`, `SyncStatus`, polling intervals) |
| Backend | `DDP_backend/ddpui/api/airbyte_api.py`, `ddpairbyte/{airbyte_service,airbytehelpers}.py` |

## Data flow

```
Add source:  POST /api/airbyte/sources/  → POST /api/airbyte/sources/check_connection/
Create connection: WS /airbyte/connection/schema_catalog (discover streams)
  → POST /api/airbyte/v1/connections/ { name, sourceId, streams[], syncCatalog, destinationSchema }
List (smart poll): GET /api/airbyte/v1/connections  (3s while any lock != null, else stop)
Sync: POST /api/prefect/v1/flows/{deploymentId}/flow_run/ → poll GET /api/prefect/flow_runs/{id}
Sync history: GET /api/airbyte/v1/connections/{id}/sync/history
Schema changes: GET /api/airbyte/v1/connection/schema_change → POST .../{id}/schema_update/schedule
```

## ⚠️ Gotchas

- **Airbyte ↔ Prefect split** — config lives in Airbyte (`connectionId`); sync runs in Prefect (`deploymentId`). Both IDs are needed to trigger and track a sync.
- **Smart polling on locks** — the list polls every 3s only while a connection has `lock !== null` (sync/reset running), then stops. Data can be briefly stale.
- **Schema discovery is async over WebSocket** — the catalog comes back via `/airbyte/connection/schema_catalog`, not a REST poll; source spec is fetched before connection creation.
- **Post-creation stream changes need a catalog refresh** + `scheduleSchemaUpdate`.
