import { getSourceHelp } from './wizard-state';

export function SourceHelperPanel({ sourceName }: { sourceName: string }) {
  const help = getSourceHelp(sourceName);
  return (
    <aside className="rounded-lg border bg-muted/40 p-4" data-testid="source-helper-panel">
      <h3 className="text-sm font-semibold">{help.title}</h3>
      <ol className="mt-3 space-y-3">
        {help.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-sm text-muted-foreground">
            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border text-xs">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </aside>
  );
}
