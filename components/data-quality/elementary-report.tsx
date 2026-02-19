'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api';
import { toastSuccess, toastError } from '@/lib/toast';
import { API_BASE_URL } from '@/lib/config';
import { formatDistanceToNow } from 'date-fns';
import { ElementaryReportTokenResponse } from './types';

const LOCK_POLL_INTERVAL = 5000;

export function ElementaryReport() {
  const [loading, setLoading] = useState(true);
  const [elementaryToken, setElementaryToken] = useState('');
  const [generatedAt, setGeneratedAt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const lockIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const clearLockPolling = useCallback(() => {
    if (lockIntervalRef.current) {
      clearInterval(lockIntervalRef.current);
      lockIntervalRef.current = null;
    }
  }, []);

  const fetchReportToken = useCallback(async () => {
    try {
      const response: ElementaryReportTokenResponse = await apiPost(
        '/api/dbt/fetch-elementary-report/',
        {}
      );
      if (response.token) {
        setElementaryToken(response.token);
        setGeneratedAt(formatDistanceToNow(new Date(response.created_on_utc), { addSuffix: true }));
      }
    } catch (err: any) {
      toastError.api(err, 'Failed to fetch report');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  const startLockPolling = useCallback(() => {
    clearLockPolling();
    lockIntervalRef.current = setInterval(async () => {
      try {
        const response = await apiGet('/api/prefect/tasks/elementary-lock/');
        if (!response) {
          // Lock released — report is ready
          clearLockPolling();
          if (mountedRef.current) {
            setIsGenerating(false);
            toastSuccess.generic('Report generated successfully');
            fetchReportToken();
          }
        }
      } catch (err: any) {
        clearLockPolling();
        if (mountedRef.current) {
          setIsGenerating(false);
          toastError.api(err, 'Error checking report status');
        }
      }
    }, LOCK_POLL_INTERVAL);
  }, [clearLockPolling, fetchReportToken]);

  const checkForLock = useCallback(async () => {
    try {
      const response = await apiGet('/api/prefect/tasks/elementary-lock/');
      if (response) {
        setIsGenerating(true);
        startLockPolling();
      }
    } catch (err: any) {
      // Lock check error is non-fatal on initial load
      console.error('Lock check error:', err);
    }
  }, [startLockPolling]);

  const handleRegenerate = async () => {
    try {
      setIsGenerating(true);
      const response = await apiPost('/api/dbt/v1/refresh-elementary-report/', {});
      if (response.flow_run_id) {
        toastSuccess.generic(
          'Your latest report is being generated. This may take a few minutes. Thank you for your patience'
        );
        startLockPolling();
      }
    } catch (err: any) {
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
    <div className="flex flex-col h-full" data-testid="elementary-report">
      {/* Header bar */}
      <div className="flex items-center justify-between px-1 py-2">
        <div>
          {elementaryToken && (
            <p className="text-lg font-semibold" data-testid="last-generated">
              Last generated: <span className="font-normal">{generatedAt}</span>
            </p>
          )}
        </div>
        <Button
          onClick={handleRegenerate}
          disabled={isGenerating}
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
          <p className="text-lg text-muted-foreground" data-testid="no-report-message">
            No report available. Please click on the button above to generate if you believe a
            report should be available.
          </p>
        )}
      </div>
    </div>
  );
}
