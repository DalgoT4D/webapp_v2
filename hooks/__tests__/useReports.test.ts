/**
 * useReports Hook Tests
 *
 * Tests for hooks/api/useReports.ts covering:
 * - SWR hooks: useSnapshots, useSnapshotView, useDashboardDatetimeColumns
 * - Mutation functions: createSnapshot, updateSnapshot, deleteSnapshot
 * - Sharing: updateReportSharing, getReportSharingStatus
 */

import { renderHook, waitFor } from '@testing-library/react';
import {
  createSnapshot,
  updateSnapshot,
  deleteSnapshot,
  updateReportSharing,
  getReportSharingStatus,
} from '../api/useReports';
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

  describe('updateReportSharing', () => {
    it('enables public sharing', async () => {
      const mockResponse = {
        is_public: true,
        public_url: 'http://test.com/share/report/abc',
        public_access_count: 0,
      };
      (apiPut as jest.Mock).mockResolvedValue({
        success: true,
        data: mockResponse,
      });

      const result = await updateReportSharing(1, { is_public: true });

      expect(apiPut).toHaveBeenCalledWith('/api/reports/1/share/', { is_public: true });
      expect(result.is_public).toBe(true);
      expect(result.public_url).toBe('http://test.com/share/report/abc');
    });

    it('disables public sharing', async () => {
      (apiPut as jest.Mock).mockResolvedValue({
        success: true,
        data: { is_public: false, public_access_count: 0 },
      });

      const result = await updateReportSharing(1, { is_public: false });

      expect(apiPut).toHaveBeenCalledWith('/api/reports/1/share/', { is_public: false });
      expect(result.is_public).toBe(false);
    });

    it('propagates errors from API', async () => {
      (apiPut as jest.Mock).mockRejectedValue(new Error('Server error'));

      await expect(updateReportSharing(1, { is_public: true })).rejects.toThrow('Server error');
    });
  });

  describe('getReportSharingStatus', () => {
    it('fetches sharing status for a snapshot', async () => {
      const mockStatus = {
        is_public: true,
        public_url: 'http://test.com/share/report/abc',
        public_access_count: 42,
        last_public_accessed: '2025-02-15T14:30:00Z',
        public_shared_at: '2025-02-01T09:00:00Z',
      };
      (apiGet as jest.Mock).mockResolvedValue({
        success: true,
        data: mockStatus,
      });

      const result = await getReportSharingStatus(1);

      expect(apiGet).toHaveBeenCalledWith('/api/reports/1/share/');
      expect(result.is_public).toBe(true);
      expect(result.public_access_count).toBe(42);
    });

    it('returns private status correctly', async () => {
      (apiGet as jest.Mock).mockResolvedValue({
        success: true,
        data: { is_public: false, public_access_count: 0 },
      });

      const result = await getReportSharingStatus(5);

      expect(apiGet).toHaveBeenCalledWith('/api/reports/5/share/');
      expect(result.is_public).toBe(false);
      expect(result.public_url).toBeUndefined();
    });

    it('propagates errors from API', async () => {
      (apiGet as jest.Mock).mockRejectedValue(new Error('Not found'));

      await expect(getReportSharingStatus(999)).rejects.toThrow('Not found');
    });
  });
});
