---
description: Reports feature domain map — dashboard snapshots, sharing, comments, and print layout.
paths:
  - "components/reports/**"
  - "app/reports/**"
  - "types/reports.ts"
---

# Reports — Domain Map

Reports are **point-in-time snapshots of dashboards** (which embed charts) with sharing, commenting, and print/export. They sit downstream of dashboards (`rules/dashboards.md`) and charts (`rules/charts.md`).

## Where things live

| Concern | Location |
|---|---|
| Pages | `app/reports/page.tsx` (list), `app/reports/[snapshotId]/` (single snapshot view) |
| Sharing | `share-via-email-dialog.tsx`, `share-via-link-dialog.tsx`, modal `components/share/ShareModal.tsx` (+ `components/share/` sections, hooks, logic) |
| Comments | `comment-popover.tsx` (shell) + `comments/` + `logic/comments.ts` |
| Viewer | `viewer/` + `logic/comment-deep-link.ts` |
| Create | `create-snapshot-dialog.tsx` + `create/` + `logic/create-report.ts` |
| Print | `print-layout.tsx` + `logic/print-rows.ts` |
| List | `list/` + `components/list-page/` |
| Feature utils | `components/reports/utils.ts` |
| Hooks | `hooks/api/useReports.ts`, `hooks/api/useComments.ts` |
| Types | `types/reports.ts`, `types/comments.ts` |

## How it fits together

```
A dashboard → create-snapshot-dialog → useReports (POST) → a report snapshot (frozen view)
  ├─ app/reports/[snapshotId] renders the frozen snapshot
  ├─ share-via-link / share-via-email dialogs + ShareModal → share via link (public), people, or email
  ├─ comment-icon / comment-popover → threaded comments (useComments) anchored on the snapshot
  └─ print-layout → print/PDF export
```

## ⚠️ Gotchas

- A report is a **frozen snapshot** — it does not live-update when the underlying dashboard or charts change. Editing charts/dashboards does not alter an existing snapshot.
- **Public/shared views** bypass normal auth — share routes render without an org session. Verify what data a share link exposes before changing snapshot payloads.
- Comments are anchored to a snapshot, not to the live dashboard.
