'use client';

import { useState, useCallback } from 'react';
import { Loader2, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DataPreview } from '@/components/charts/DataPreview';
import { testAlert } from '@/hooks/api/useAlerts';
import { toastError } from '@/lib/toast';
import type { AlertQueryConfig, AlertTestResult } from '@/types/alert';

interface AlertTestPreviewProps {
  queryConfig: AlertQueryConfig;
  disabled?: boolean;
}

export function AlertTestPreview({ queryConfig, disabled }: AlertTestPreviewProps) {
  const [testResult, setTestResult] = useState<AlertTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testPage, setTestPage] = useState(1);
  const [testPageSize, setTestPageSize] = useState(20);

  const handleTest = useCallback(
    async (page: number = testPage, pageSize: number = testPageSize) => {
      setIsLoading(true);
      try {
        const result = await testAlert({
          query_config: queryConfig,
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
    [queryConfig, testPage, testPageSize]
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
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Testing...
          </>
        ) : (
          'Test Alert'
        )}
      </Button>

      {testResult && (
        <div className="space-y-3">
          {/* Status message */}
          <div
            className={`flex items-center gap-2 p-3 rounded-md ${
              testResult.would_fire ? 'bg-red-50 text-red-800' : 'bg-green-50 text-green-800'
            }`}
            data-testid="test-alert-status"
          >
            {testResult.would_fire ? (
              <>
                <AlertTriangle className="h-4 w-4" />
                <span>
                  Alert would fire &mdash; {testResult.total_rows} row
                  {testResult.total_rows !== 1 ? 's' : ''} match
                </span>
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Alert would NOT fire &mdash; no rows match the condition</span>
              </>
            )}
          </div>

          {/* Data table */}
          {testResult.results.length > 0 && (
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
          )}

          {/* Collapsible SQL */}
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              View generated SQL
            </summary>
            <pre className="mt-2 p-3 bg-muted rounded-md overflow-x-auto text-xs">
              {testResult.query_executed}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
