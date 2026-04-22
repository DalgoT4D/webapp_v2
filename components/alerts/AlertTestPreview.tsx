'use client';

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle, AlertTriangle, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataPreview } from '@/components/charts/DataPreview';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { testAlert } from '@/hooks/api/useAlerts';
import { toastError } from '@/lib/toast';
import type { AlertQueryConfig, AlertTestResult, MetricRagLevel } from '@/types/alert';

interface AlertTestPreviewProps {
  queryConfig: AlertQueryConfig;
  kpiId?: number | null;
  metricRagLevel?: MetricRagLevel | null;
  message: string;
  groupMessage?: string;
  disabled?: boolean;
}

export function AlertTestPreview({
  queryConfig,
  kpiId,
  metricRagLevel,
  message,
  groupMessage,
  disabled,
}: AlertTestPreviewProps) {
  const [testResult, setTestResult] = useState<AlertTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testPage, setTestPage] = useState(1);
  const [testPageSize, setTestPageSize] = useState(20);

  const handleTest = useCallback(
    async (page: number = testPage, pageSize: number = testPageSize) => {
      setIsLoading(true);
      try {
        const result = await testAlert({
          kpi_id: kpiId ?? null,
          metric_rag_level: metricRagLevel ?? null,
          query_config: queryConfig,
          message,
          group_message: groupMessage ?? '',
          page,
          page_size: pageSize,
        });
        setTestResult(result);
        setTestPage(page);
        setTestPageSize(pageSize);
      } catch (error: unknown) {
        toastError.api(error);
        setTestResult(null);
      } finally {
        setIsLoading(false);
      }
    },
    [groupMessage, message, kpiId, metricRagLevel, queryConfig, testPage, testPageSize]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      handleTest(newPage, testPageSize);
    },
    [handleTest, testPageSize]
  );

  const handlePageSizeChange = useCallback(
    (newPageSize: number) => {
      handleTest(1, newPageSize);
    },
    [handleTest]
  );

  const columns =
    testResult?.results && testResult.results.length > 0 ? Object.keys(testResult.results[0]) : [];

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        onClick={() => handleTest(1, testPageSize)}
        disabled={disabled || isLoading}
        data-testid="test-alert-btn"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating preview...
          </>
        ) : (
          'Preview alert'
        )}
      </Button>

      {testResult && (
        <div className="space-y-3">
          <div
            className={`flex items-center gap-2 rounded-md p-3 ${
              testResult.would_fire ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
            }`}
            data-testid="test-alert-status"
          >
            {testResult.would_fire ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Alert would fire. {testResult.total_rows} failing result
                  {testResult.total_rows !== 1 ? 's' : ''} matched.
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Alert would not fire for the current data.</span>
              </>
            )}
          </div>

          <Tabs defaultValue="results" className="space-y-3">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="results">Results</TabsTrigger>
              <TabsTrigger value="email">Email preview</TabsTrigger>
            </TabsList>

            <TabsContent value="results" className="mt-0 space-y-3">
              {testResult.results.length > 0 ? (
                <DataPreview
                  data={testResult.results}
                  columns={columns}
                  pagination={{
                    page: testResult.page,
                    pageSize: testResult.page_size,
                    total: testResult.total_rows,
                    onPageChange: handlePageChange,
                    onPageSizeChange: handlePageSizeChange,
                  }}
                />
              ) : (
                <div className="rounded-lg border bg-white p-6 text-sm text-muted-foreground">
                  No failing rows were returned for the current configuration.
                </div>
              )}
            </TabsContent>

            <TabsContent value="email" className="mt-0 space-y-3">
              <div className="rounded-lg border bg-white p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Rendered alert email
                </div>
                <pre className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {testResult.rendered_message || 'No email content to preview yet.'}
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View generated SQL
            </summary>
            <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
              {testResult.query_executed}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
