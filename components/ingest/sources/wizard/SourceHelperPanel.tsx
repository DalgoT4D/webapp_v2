import { getSourceHelp } from './wizard-state';

export function SourceHelperPanel({ sourceName }: { sourceName: string }) {
  const help = getSourceHelp(sourceName);
  return (
    <aside className="rounded-xl border bg-muted/30 p-6" data-testid="source-helper-panel">
      <h3 className="text-base font-semibold">{help.title}</h3>
      <ol className="mt-4 divide-y">
        {help.steps.map((step, i) => (
          <li key={i} className="flex gap-3 py-4 first:pt-0 last:pb-0">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border bg-background text-xs font-medium text-muted-foreground">
              {i + 1}
            </span>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </aside>
  );
}
