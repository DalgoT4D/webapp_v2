'use client';

import React from 'react';
import { AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Library } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ChartMetric } from '@/types/charts';
import {
  SavedMetricTab,
  type SavedMetric,
} from '@/components/charts/builder/metrics/SavedMetricTab';
import { SimpleMetricTab } from '@/components/charts/builder/metrics/SimpleMetricTab';
import { CalculatedMetricTab } from '@/components/charts/builder/metrics/CalculatedMetricTab';
import { SaveToLibrarySection } from '@/components/charts/builder/metrics/SaveToLibrarySection';
import { autoLabel, summaryOf } from '@/components/charts/logic/metric-labels';
import { validateMetric } from '@/hooks/api/useMetrics';
import { useDebounce } from '@/hooks/useDebounce';

// Wait this long after the user stops typing before auto-validating + committing a calculated
// expression, so we don't fire a request (and re-render the chart) on every keystroke.
const EXPRESSION_COMMIT_DEBOUNCE_MS = 500;

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
  // Debounced copy of the expression — auto-validate/commit only fires once typing pauses.
  const debouncedExpr = useDebounce(exprDraft, EXPRESSION_COMMIT_DEBOUNCE_MS);
  const validateReqIdRef = React.useRef(0);
  const [validating, setValidating] = React.useState(false);
  const [exprError, setExprError] = React.useState<string | null>(null);
  // The user "owns" the Display Name once they type one; until then it auto-follows the definition.
  // A label is treated as auto (and will keep mirroring the definition) when it's empty or still
  // equals the generated label — for calculated metrics that's the raw expression, for simple ones
  // the Function(Column) label. A label that differs is a genuine custom name and is preserved.
  const [aliasCustomized, setAliasCustomized] = React.useState(() => {
    if (metric.column_expression) {
      return !!metric.alias && metric.alias !== metric.column_expression;
    }
    return !!metric.alias && metric.alias !== autoLabel(metric.aggregation, metric.column);
  });
  // Local Display Name input. We debounce user edits to the parent (like DebouncedInput did), but
  // crucially DON'T echo external/programmatic alias changes back as edits — that echo is what used
  // to mark the name "customized" and block auto-follow.
  const [aliasInput, setAliasInput] = React.useState(metric.alias || '');
  const debouncedAliasInput = useDebounce(aliasInput, EXPRESSION_COMMIT_DEBOUNCE_MS);

  const summary = summaryOf(metric);
  const labels =
    chartType === 'pie'
      ? { column: 'Dimension', function: 'Metric' }
      : { column: 'Column', function: 'Function' };

  // Wrap a Simple-mode update so the alias follows the new function/column (unless the user has
  // typed their own Display Name).
  const withAutoAlias = (partial: Partial<ChartMetric>): Partial<ChartMetric> => {
    if (aliasCustomized) return partial;
    const nextAgg = partial.aggregation ?? metric.aggregation ?? 'count';
    const nextCol = partial.column !== undefined ? partial.column : (metric.column ?? null);
    return { ...partial, alias: autoLabel(nextAgg, nextCol) };
  };

  const commitExpression = async () => {
    const expr = exprDraft.trim();
    if (!expr || expr === (metric.column_expression || '')) return;
    if (!schemaName || !tableName) return;
    // Guards against a slow earlier response landing after a newer edit (debounce + blur can race).
    const reqId = ++validateReqIdRef.current;
    setValidating(true);
    setExprError(null);
    try {
      const result = await validateMetric({
        name: 'validation_check',
        schema_name: schemaName,
        table_name: tableName,
        column_expression: expr,
      });
      if (reqId !== validateReqIdRef.current) return; // superseded by a newer edit
      if (!result.valid) {
        setExprError(result.error || 'Invalid expression');
        return;
      }
      onUpdate({
        column_expression: expr,
        column: null,
        aggregation: null,
        // Keep the Display Name mirroring the expression unless the user typed their own label.
        ...(aliasCustomized ? {} : { alias: expr }),
      });
    } catch (err) {
      if (reqId !== validateReqIdRef.current) return;
      setExprError(err instanceof Error ? err.message : 'Validation failed');
    } finally {
      if (reqId === validateReqIdRef.current) setValidating(false);
    }
  };

  // Auto-validate + commit the (debounced) calculated expression so the chart re-executes while
  // typing, without needing to click away. commitExpression no-ops when the value is unchanged or
  // empty, so this is safe to fire on every debounced change.
  React.useEffect(() => {
    if (mode !== 'calculated') return;
    commitExpression();
    // commitExpression reads the latest exprDraft/schema/table via closure; debouncedExpr is the
    // trigger. Intentionally not depending on commitExpression (re-created each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedExpr, mode]);

  // Mirror external alias changes (e.g. the auto-follow commit) into the local input WITHOUT
  // propagating them back — this is the anti-echo half.
  React.useEffect(() => {
    setAliasInput(metric.alias || '');
  }, [metric.alias]);

  // Propagate the debounced local edit to the parent, but only when it actually differs from the
  // stored alias — so a value that arrived via the sync effect above never round-trips as an edit.
  React.useEffect(() => {
    if (debouncedAliasInput !== (metric.alias || '')) onUpdate({ alias: debouncedAliasInput });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedAliasInput]);

  const handleTabChange = (v: string) => {
    const newMode = v as 'simple' | 'calculated' | 'saved';
    // Leaving/entering a tab clears any stale validation error, and invalidates an in-flight
    // validation so its response can't commit after the switch.
    setExprError(null);
    setValidating(false);
    validateReqIdRef.current++;
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
      // withAutoAlias keeps the Display Name in sync with the new definition (e.g. COUNT(*))
      // instead of leaving the old expression's label behind.
      onUpdate(withAutoAlias(partial));
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
      <Input
        id={`metric-alias-${index}`}
        data-testid={`metric-alias-${index}`}
        value={aliasInput}
        onChange={(e) => {
          // Fires only on real keystrokes (plain input), never on programmatic sync. A non-empty
          // manual label means the user owns the name; clearing it re-enables auto-follow.
          setAliasInput(e.target.value);
          setAliasCustomized(e.target.value.trim().length > 0);
        }}
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
            <TabsTrigger
              value="simple"
              className="flex-1 text-xs"
              data-testid={`metric-tab-simple-${index}`}
            >
              Simple
            </TabsTrigger>
            <TabsTrigger
              value="calculated"
              className="flex-1 text-xs"
              data-testid={`metric-tab-calculated-${index}`}
            >
              Calculated
            </TabsTrigger>
            <TabsTrigger
              value="saved"
              className="flex-1 text-xs"
              data-testid={`metric-tab-saved-${index}`}
            >
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="mt-2 space-y-2">
            <SavedMetricTab
              index={index}
              metric={metric}
              savedMetrics={savedMetrics}
              isSavedMetricAdded={isSavedMetricAdded}
              disabled={disabled}
              onPick={pickSavedMetric}
            />
          </TabsContent>

          <TabsContent value="simple" className="mt-2 space-y-2">
            <SimpleMetricTab
              index={index}
              metric={metric}
              columns={columns}
              chartType={chartType}
              labels={labels}
              disabled={disabled}
              onUpdate={(partial) => onUpdate(withAutoAlias(partial))}
            />
          </TabsContent>

          <TabsContent value="calculated" className="mt-2 space-y-2">
            <CalculatedMetricTab
              index={index}
              exprDraft={exprDraft}
              onExprChange={(value) => {
                setExprDraft(value);
                setExprError(null);
              }}
              onBlur={commitExpression}
              validating={validating}
              exprError={exprError}
              disabled={disabled}
            />
          </TabsContent>
        </Tabs>

        {/* Display Name (chart label) — editable in every mode, including a linked saved metric.
            Hidden for number (big number) charts since the label has no visible effect there. */}
        {chartType !== 'number' && displayNameField}

        {/* Save-to-library — only for the editable (Simple / Calculated) modes. */}
        <SaveToLibrarySection
          index={index}
          mode={mode}
          schemaName={schemaName}
          tableName={tableName}
          disabled={disabled}
          saving={saving}
          onSaveToLibrary={onSaveToLibrary}
        />
      </AccordionContent>
    </AccordionItem>
  );
}
