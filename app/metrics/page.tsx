'use client';

/**
 * Metrics library — placeholder page.
 *
 * Batch 5 of the KPI+Alerts overhaul will turn this into the full reusable-
 * primitive library (list, search, tags, create/edit/delete, references).
 * For now it renders a stub so the nav entry resolves and the existing
 * route shape is preserved.
 */
export default function MetricsLibraryPage() {
  return (
    <div className="flex h-full flex-col items-center justify-center p-12 text-center">
      <h1 className="text-2xl font-bold mb-2">Metrics library</h1>
      <p className="text-sm text-muted-foreground max-w-md">
        The reusable Metric primitive library is coming in the next build batch. You can already
        create Metrics inline from a KPI or chart.
      </p>
    </div>
  );
}
