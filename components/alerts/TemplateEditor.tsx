'use client';

import { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { TOKENS_BY_TYPE, type AlertType } from '@/types/alerts';

interface TemplateEditorProps {
  value: string;
  onChange: (value: string) => void;
  alertType: AlertType;
  /** Optional sample values to render in the live preview pane (hidden by default). */
  sampleValues?: Record<string, string | number | null | undefined>;
  textareaRef?: React.Ref<HTMLTextAreaElement>;
  /** When true, render a small live preview block beneath the textarea. Defaults to false. */
  showPreview?: boolean;
}

/** Human-readable label for an internal token name (e.g. `alert_name` → "Alert name"). */
function tokenLabel(token: string): string {
  return token
    .split('_')
    .map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w === 'rag' ? 'RAG' : w))
    .join(' ');
}

function renderMustache(template: string, values: Record<string, unknown>): string {
  return template.replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (full, token: string) => {
    const v = values[token];
    if (v === undefined || v === null || v === '') return full;
    return String(v);
  });
}

export function TemplateEditor({
  value,
  onChange,
  alertType,
  sampleValues,
  textareaRef,
  showPreview = false,
}: TemplateEditorProps) {
  const tokens = TOKENS_BY_TYPE[alertType] || [];
  const preview = useMemo(
    () => renderMustache(value || '', sampleValues || {}),
    [value, sampleValues]
  );

  const insertToken = (token: string) => {
    onChange(`${value || ''}${value && !value.endsWith(' ') ? ' ' : ''}{{${token}}}`);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Message Template</p>
      <p className="text-sm text-gray-500">Available tokens (click to insert)</p>
      <div className="flex flex-wrap gap-2">
        {tokens.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => insertToken(t)}
            data-testid={`token-${t}`}
            className="rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
          >
            {tokenLabel(t)}
          </button>
        ))}
      </div>
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Alert: {{alert_name}} fired. Current value is {{current_value}} vs target {{target_value}}."
        rows={5}
        className="font-mono text-sm"
      />
      {showPreview && (
        <div className="rounded-md border bg-muted/30 p-2">
          <p className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Live preview
          </p>
          <p className="whitespace-pre-wrap break-words text-sm">
            {preview || (
              <span className="italic text-muted-foreground">
                Preview appears here as you type.
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
