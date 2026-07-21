'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { toastSuccess, toastError } from '@/lib/toast';
import { API_BASE_URL } from '@/lib/config';
import { formatDistanceToNow } from 'date-fns';
import { LOCK_POLL_INTERVAL_MS } from '@/constants/data-quality';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { PERMISSIONS, useRbac } from '@/lib/rbac';
import {
  fetchElementaryReport,
  refreshElementaryReport,
  checkElementaryLock,
} from '@/hooks/api/useElementaryStatus';
import { cronToString, localTimezone } from '@/components/pipeline/utils';

export function ElementaryReport() {
  const [loading, setLoading] = useState(true);
  const [elementaryToken, setElementaryToken] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [scheduleCron, setScheduleCron] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const { hasPermission } = useRbac();
  // Regenerating the report rebuilds Elementary in the dbt workspace — gate on edit access.
  const canRegenerate = hasPermission(PERMISSIONS.CAN_EDIT_DBT_WORKSPACE);

  const clearLockPolling = useCallback(() => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
  }, []);

  const fetchReportToken = useCallback(async () => {
    try {
      const response = await fetchElementaryReport();
      // Backend returns `report_exists: false` when no EDR run has produced a
      // report within the lookback window — that's a normal empty state, not
      // an error. The "No report available" UI below handles it.
      if (response.report_exists) {
        setElementaryToken(response.token);
        setGeneratedAt(formatDistanceToNow(new Date(response.created_on_utc), { addSuffix: true }));
      }
      // Schedule is present on both response shapes (or null if EDR isn't set up).
      if (response.schedule) {
        setScheduleCron(response.schedule.cron);
      }
    } catch (err: unknown) {
      toastError.api(err, 'Failed to fetch report');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const startLockPolling = useCallback(() => {
    clearLockPolling();
    lockIntervalRef.current = setInterval(async () => {
      try {
        const response = await checkElementaryLock();
        if (!response) {
          // Lock released — report is ready
          clearLockPolling();
          if (mountedRef.current) {
            setIsGenerating(false);
            toastSuccess.generic('Report generated successfully');
            fetchReportToken();
          }
        }
      } catch (err: unknown) {
        clearLockPolling();
        if (mountedRef.current) {
          setIsGenerating(false);
          toastError.api(err, 'Error checking report status');
        }
      }
    }, LOCK_POLL_INTERVAL_MS);
  }, [clearLockPolling, fetchReportToken]);

  const checkForLock = useCallback(async () => {
    try {
      const response = await checkElementaryLock();
      if (response) {
        setIsGenerating(true);
        startLockPolling();
      }
    } catch (err: unknown) {
      // Lock check error is non-fatal on initial load
      console.error('Lock check error:', err);
    }
  }, [startLockPolling]);

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      const response = await refreshElementaryReport();
      if (response.flow_run_id) {
        trackEvent(ANALYTICS_EVENTS.DATA_QUALITY_REPORT_GENERATED);
        toastSuccess.generic(
          'Your latest report is being generated. This may take a few minutes. Thank you for your patience'
        );
        startLockPolling();
      }
    } catch (err: unknown) {
      toastError.api(err, 'Failed to regenerate report');
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchReportToken();
    checkForLock();
    return () => {
      mountedRef.current = false;
      clearLockPolling();
    };
  }, [fetchReportToken, checkForLock, clearLockPolling]);

  return (
    <div id="elementary-report" className="flex flex-col h-full" data-testid="elementary-report">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 py-2">
        <div className="flex flex-col gap-1">
          {elementaryToken && (
            <p className="text-base font-semibold text-gray-900" data-testid="last-generated">
              Last generated: <span className="font-normal text-gray-700">{generatedAt}</span>
            </p>
          )}
          {scheduleCron && (
            <p className="text-sm text-gray-500" data-testid="report-schedule">
              Reports run:{' '}
              <span className="font-medium text-gray-700">{cronToString(scheduleCron)}</span>{' '}
              <span>({localTimezone()})</span>
            </p>
          )}
        </div>
        <Button
          variant="primary"
          onClick={handleRegenerate}
          disabled={isGenerating || !canRegenerate}
          data-testid="regenerate-report-btn"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating report
            </>
          ) : (
            'Regenerate report'
          )}
        </Button>
      </div>

      {/* Report content */}
      <div className="flex-1 bg-white rounded-lg p-4 flex flex-col items-center justify-center">
        {loading ? (
          <Loader2 className="h-8 w-8 animate-spin text-primary" data-testid="report-loader" />
        ) : elementaryToken ? (
          <iframe
            src={`${API_BASE_URL}/elementary/${elementaryToken}`}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 210px)' }}
            title="Elementary Report"
            data-testid="elementary-iframe"
          />
        ) : (
          <p
            className="text-base text-gray-500 text-center max-w-md"
            data-testid="no-report-message"
          >
            No report available yet. Click the button above to generate one if you believe a report
            should be available.
          </p>
        )}
      </div>
    </div>
  );
}
