'use client';

import React from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Combobox, highlightText } from '@/components/ui/combobox';
import { DebouncedInput } from '@/components/charts/debounced-input';
import { ColumnTypeIcon } from '@/lib/columnTypeIcons';
import { X, Loader2, Library, Save, ChevronDown } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChartMetric } from '@/types/charts';
import { getAvailableColumns, AGGREGATE_FUNCTIONS } from './MetricsSelector';
import { validateMetric } from '@/hooks/api/useMetrics';

interface SavedMetric {
  id: number;
  name: string;
  column?: string | null;
  aggregation?: string | null;
  column_expression?: string | null;
}

export interface MetricAccordionItemProps {
  metric: ChartMetric;
  uid: string; // accordion item value + react key (client-only)
  index: number;
  columns: Array<{ column_name: string; data_type: string }>;
  disabled?: boolean;
  chartType?: string;
  schemaName?: string;
  tableName?: string;
  savedMetrics?: SavedMetric[];
  isSavedMetricAdded?: (id: number) => boolean;
  saving?: boolean;
  onUpdate: (partial: Partial<ChartMetric>) => void;
  onRemove: () => void;
  onSaveToLibrary?: (metricName: string, mode: 'simple' | 'calculated') => void;
}

function summaryOf(metric: ChartMetric) {
  return metric.column_expression
    ? metric.column_expression.slice(0, 40)
    : `${(metric.aggregation || '').toUpperCase()}(${metric.column || '*'})`;
}

export function MetricAccordionItem({
  metric,
  uid,
  index,
  columns,
  disabled,
  chartType = 'bar',
  schemaName,
  tableName,
  savedMetrics = [],
  isSavedMetricAdded,
  saving,
  onUpdate,
  onRemove,
  onSaveToLibrary,
}: MetricAccordionItemProps) {
  // All hooks run unconditionally (Rules of Hooks).
  const isLibrary = !!metric.saved_metric_id;
  const isCalculated = !!metric.column_expression;

  const [mode, setMode] = React.useState<'simple' | 'calculated' | 'saved'>(
    isLibrary ? 'saved' : isCalculated ? 'calculated' : 'simple'
  );

  // Acquiring a saved_metric_id (picking a saved metric OR saving this row to the library)
  // flips the row to the Saved tab so the linked metric shows selected. Detach clears the id and
  // sets mode manually, so this never fights the Simple/Calculated switch.
  React.useEffect(() => {
    if (metric.saved_metric_id) setMode('saved');
  }, [metric.saved_metric_id]);
  const [exprDraft, setExprDraft] = React.useState(metric.column_expression || '');
  const [validating, setValidating] = React.useState(false);
  const [exprError, setExprError] = React.useState<string | null>(null);
  const [metricName, setMetricName] = React.useState('');
  const [showSaveSection, setShowSaveSection] = React.useState(false);

  const summary = summaryOf(metric);
  const labels =
    chartType === 'pie'
      ? { column: 'Dimension', function: 'Metric' }
      : { column: 'Column', function: 'Function' };

  // Keep the Display Name auto-synced to the metric definition until the user customizes it.
  const autoLabel = (agg?: string | null, col?: string | null) =>
    `${(agg || 'count').toUpperCase()}(${col || '*'})`;
  // The display name is "auto" (follows the definition) when it's empty or still equals the
  // generated label for the current function/column (or the raw expression). Once the user types
  // their own label, it no longer matches and we stop overwriting it.
  const aliasIsAuto =
    !metric.alias ||
    metric.alias === autoLabel(metric.aggregation, metric.column) ||
    metric.alias === (metric.column_expression || '');
  // Wrap a Simple-mode update so the alias follows the new function/column (unless customized).
  const withAutoAlias = (partial: Partial<ChartMetric>): Partial<ChartMetric> => {
    if (!aliasIsAuto) return partial;
    const nextAgg = partial.aggregation ?? metric.aggregation ?? 'count';
    const nextCol = partial.column !== undefined ? partial.column : (metric.column ?? null);
    return { ...partial, alias: autoLabel(nextAgg, nextCol) };
  };

  const commitExpression = async () => {
    const expr = exprDraft.trim();
    if (!expr || expr === (metric.column_expression || '')) return;
    if (!schemaName || !tableName) return;
    setValidating(true);
    setExprError(null);
    try {
      const result = await validateMetric({
        name: 'validation_check',
        schema_name: schemaName,
        table_name: tableName,
        column_expression: expr,
      });
      if (!result.valid) {
        setExprError(result.error || 'Invalid expression');
        return;
      }
      onUpdate({
        column_expression: expr,
        column: null,
        aggregation: null,
        ...(aliasIsAuto ? { alias: expr.slice(0, 30) } : {}),
      });
    } catch (err) {
      setExprError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      setValidating(false);
    }
  };

  const handleTabChange = (v: string) => {
    const newMode = v as 'simple' | 'calculated' | 'saved';
    if (newMode === 'simple') {
      // Detach from the library (if linked) and drop any expression.
      const partial: Partial<ChartMetric> = { column_expression: undefined };
      if (isLibrary) partial.saved_metric_id = undefined;
      // A calculated definition has no column/function, so reset to a valid COUNT default.
      // A simple saved metric already carries its column/aggregation — keep them to edit from.
      if (metric.column_expression) {
        partial.aggregation = 'count';
        partial.column = null;
      }
      onUpdate(partial);
    }
    if (newMode === 'calculated') {
      setExprDraft(metric.column_expression || '');
      if (isLibrary) onUpdate({ saved_metric_id: undefined });
    }
    setMode(newMode);
  };

  const pickSavedMetric = (savedMetricId: string) => {
    const sm = savedMetrics.find((m) => m.id.toString() === savedMetricId);
    if (!sm) return;
    onUpdate({
      saved_metric_id: sm.id,
      column: sm.column_expression ? null : sm.column,
      aggregation: sm.column_expression ? null : sm.aggregation || 'count',
      column_expression: sm.column_expression || undefined,
      alias: sm.name,
    });
  };

  const displayNameField = (
    <div className="space-y-1">
      <Label htmlFor={`metric-alias-${index}`} className="text-xs text-gray-600">
        Display Name In Charts
      </Label>
      <DebouncedInput
        id={`metric-alias-${index}`}
        data-testid={`metric-alias-${index}`}
        value={metric.alias || ''}
        onChange={(value: string) => onUpdate({ alias: value })}
        placeholder="Pick a label"
        className="h-8 text-sm"
        disabled={disabled}
      />
    </div>
  );

  return (
    <AccordionItem value={uid} className="border rounded-lg px-3 last:border-b">
      <div className="flex items-center justify-between">
        <AccordionTrigger
          className="flex-1 py-3 hover:no-underline cursor-pointer"
          data-testid={`metric-trigger-${index}`}
        >
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-medium truncate text-primary">
                {metric.alias || summary}
              </span>
              {isLibrary && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Library
                        className="h-3 w-3 text-blue-600 shrink-0 cursor-help"
                        data-testid={`metric-library-icon-${index}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      Saved to library
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="text-sm text-foreground">{summary}</div>
          </div>
        </AccordionTrigger>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Remove metric"
          data-testid={`remove-metric-${index}`}
          className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 shrink-0"
          onClick={onRemove}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AccordionContent className="pb-3 space-y-3">
        <Tabs value={mode} onValueChange={handleTabChange}>
          <TabsList className="w-full h-8">
            <TabsTrigger value="simple" className="flex-1 text-xs">
              Simple
            </TabsTrigger>
            <TabsTrigger value="calculated" className="flex-1 text-xs">
              Calculated
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex-1 text-xs">
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-2 space-y-2">
            <Combobox
              id={`metric-saved-${index}`}
              items={savedMetrics
                // Hide metrics already added in other rows, but keep this row's own selection.
                .filter((sm) => !isSavedMetricAdded?.(sm.id) || sm.id === metric.saved_metric_id)
                .map((sm) => ({
                  value: sm.id.toString(),
                  label: sm.name,
                  summary: sm.column_expression
                    ? sm.column_expression.slice(0, 40)
                    : `${(sm.aggregation || '').toUpperCase()}(${sm.column || '*'})`,
                }))}
              value={metric.saved_metric_id?.toString() ?? ''}
              onValueChange={(v) => v && pickSavedMetric(v)}
              disabled={disabled}
              searchPlaceholder="Search metrics..."
              placeholder="Select a metric from pre-defined list"
              emptyMessage="No metrics match your search"
              noItemsMessage="No saved metrics yet"
              renderItem={(item, _sel, q) => (
                <div className="flex flex-col min-w-0">
                  <span className="truncate">{highlightText(item.label, q)}</span>
                  <span className="text-xs text-muted-foreground truncate">{item.summary}</span>
                </div>
              )}
            />
          </TabsContent>

          <TabsContent value="simple" className="mt-2 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">{labels.function} *</Label>
              <Select
                value={metric.aggregation || 'count'}
                onValueChange={(v) =>
                  onUpdate(withAutoAlias({ aggregation: v, column_expression: undefined }))
                }
                disabled={disabled}
              >
                <SelectTrigger className="h-8" data-testid={`metric-agg-${index}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGGREGATE_FUNCTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">{labels.column} *</Label>
              <Combobox
                items={getAvailableColumns(columns, metric.aggregation || 'count').map((col) => ({
                  value: col.column_name,
                  label: col.column_name === '*' ? '* (Count all rows)' : col.column_name,
                  data_type: col.data_type,
                  disabled: col.disabled,
                }))}
                value={metric.aggregation === 'count' && !metric.column ? '*' : metric.column || ''}
                onValueChange={(v) => onUpdate(withAutoAlias({ column: v === '*' ? null : v }))}
                disabled={disabled}
                searchPlaceholder="Search columns..."
                placeholder="Select column"
                compact
                renderItem={(item, _sel, q) => (
                  <div className="flex items-center gap-2 min-w-0">
                    {item.value !== '*' && (
                      <ColumnTypeIcon dataType={item.data_type} className="w-4 h-4" />
                    )}
                    <span className="truncate">{highlightText(item.label, q)}</span>
                  </div>
                )}
              />
            </div>
          </TabsContent>

          <TabsContent value="calculated" className="mt-2 space-y-2">
            <div className="space-y-1">
              <Label className="text-xs text-gray-600">Expression *</Label>
              <Textarea
                data-testid={`metric-expr-${index}`}
                value={exprDraft}
                onChange={(e) => {
                  setExprDraft(e.target.value);
                  setExprError(null);
                }}
                onBlur={commitExpression}
                placeholder="Add an expression eg. SUM(column_name)/10"
                rows={2}
                className="font-mono text-sm"
                disabled={disabled}
              />
              {validating && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Validating expression...</span>
                </div>
              )}
              {exprError && <p className="text-xs text-destructive">{exprError}</p>}
            </div>
          </TabsContent>
        </Tabs>

        {/* Display Name (chart label) — editable in every mode, including a linked saved metric. */}
        {displayNameField}

        {/* Save-to-library — only for the editable (Simple / Calculated) modes. */}
        {mode !== 'saved' && schemaName && tableName && onSaveToLibrary && (
          <div className="space-y-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-full"
              onClick={() => setShowSaveSection(!showSaveSection)}
            >
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${showSaveSection ? '' : '-rotate-90'}`}
              />
              Add metric to library
            </button>
            {showSaveSection && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-600">Metric Name *</Label>
                  <Input
                    value={metricName}
                    onChange={(e) => setMetricName(e.target.value)}
                    placeholder="Give a unique name"
                    className="h-8 text-sm"
                    disabled={disabled}
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    onSaveToLibrary(metricName, mode === 'calculated' ? 'calculated' : 'simple')
                  }
                  disabled={disabled || !metricName.trim() || saving}
                  className="w-full h-8 text-xs bg-gray-900 text-white hover:bg-gray-700"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5 mr-1" />
                  )}
                  ADD METRIC TO LIBRARY
                </Button>
              </div>
            )}
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}
