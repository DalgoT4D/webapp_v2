/**
 * useReports Hook Tests
 *
 * Tests for hooks/api/useReports.ts covering:
 * - SWR hooks: useSnapshots, useSnapshotView, useDashboardDatetimeColumns
 * - Mutation functions: createSnapshot, updateSnapshot, deleteSnapshot
 *
 * NOTE: updateReportSharing / getReportSharingStatus were removed when
 * public/private moved to PATCH /general-access. Sharing tests live under
 * useAccess (updateGeneralAccess).
 */

import { renderHook, waitFor } from '@testing-library/react';
import { createSnapshot, updateSnapshot, deleteSnapshot } from '../api/useReports';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/api';
import type { CreateSnapshotPayload } from '@/types/reports';

// ============ Test Suite ============

describe('useReports mutations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSnapshot', () => {
    const payload: CreateSnapshotPayload = {
      title: 'Q1 Report',
      dashboard_id: 1,
      date_column: { schema_name: 'public', table_name: 'sales', column_name: 'created_at' },
      period_end: '2025-03-31',
      period_start: '2025-01-01',
    };

    it('calls apiPost with correct URL and payload', async () => {
      (apiPost as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 99, title: 'Q1 Report' },
      });

      const result = await createSnapshot(payload);

      expect(apiPost).toHaveBeenCalledWith('/api/reports/', payload);
      expect(result).toEqual({ id: 99, title: 'Q1 Report' });
    });

    it('returns unwrapped data from API response', async () => {
      (apiPost as jest.Mock).mockResolvedValue({
        success: true,
        data: { id: 5, title: 'New Report', created_at: '2025-01-01T00:00:00Z' },
      });

      const result = await createSnapshot(payload);

      expect(result.id).toBe(5);
      expect(result.title).toBe('New Report');
    });

    it('propagates errors from API', async () => {
      (apiPost as jest.Mock).mockRejectedValue(new Error('Bad request'));

      await expect(createSnapshot(payload)).rejects.toThrow('Bad request');
    });
  });

  describe('updateSnapshot', () => {
    it('calls apiPut with correct URL and payload', async () => {
      (apiPut as jest.Mock).mockResolvedValue({
        success: true,
        data: { summary: 'Updated summary' },
      });

      const result = await updateSnapshot(1, { summary: 'Updated summary' });

      expect(apiPut).toHaveBeenCalledWith('/api/reports/1/', { summary: 'Updated summary' });
      expect(result).toEqual({ summary: 'Updated summary' });
    });

    it('propagates errors from API', async () => {
      (apiPut as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(updateSnapshot(999, { summary: 'test' })).rejects.toThrow('Not found');
    });
  });

  describe('deleteSnapshot', () => {
    it('calls apiDelete with correct URL', async () => {
      (apiDelete as jest.Mock).mockResolvedValue(undefined);

      await deleteSnapshot(42);

      expect(apiDelete).toHaveBeenCalledWith('/api/reports/42/');
    });

    it('propagates errors from API', async () => {
      (apiDelete as jest.Mock).mockRejectedValue(new Error('Forbidden'));

      await expect(deleteSnapshot(42)).rejects.toThrow('Forbidden');
    });
  });

  // updateReportSharing / getReportSharingStatus tests removed — endpoints
  // were consolidated into PATCH /general-access. New sharing coverage:
  // hooks/__tests__/useAccess.test.ts (updateGeneralAccess).
});
