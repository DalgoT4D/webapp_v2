import { Info } from 'lucide-react';
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
              <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      {help.note && (
        <div
          className="mt-4 flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"
          data-testid="source-helper-note"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" />
          <p className="text-sm leading-relaxed text-foreground">{help.note}</p>
        </div>
      )}
    </aside>
  );
}
