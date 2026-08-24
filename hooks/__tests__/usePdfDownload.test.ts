import { renderHook, act } from '@testing-library/react';
import { usePdfDownload } from '../usePdfDownload';

const mockApiPostBinary = jest.fn();

jest.mock('@/lib/api', () => ({
  apiPostBinary: (...args: unknown[]) => mockApiPostBinary(...args),
}));

jest.mock('@/lib/toast', () => ({
  toastSuccess: { exported: jest.fn() },
  toastError: { export: jest.fn() },
  toastInfo: { generic: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom implements neither of these, and the hook uses both to trigger the download.
  global.URL.createObjectURL = jest.fn(() => 'blob:pdf');
  global.URL.revokeObjectURL = jest.fn();
});

// The boolean is what stops REPORT_EXPORTED from counting failed exports: the hook handles
// its own errors (toast) instead of throwing, so an awaiting caller cannot otherwise tell.
describe('usePdfDownload', () => {
  it('resolves true when the PDF request succeeds', async () => {
    mockApiPostBinary.mockResolvedValue(new Blob(['pdf']));
    const { result } = renderHook(() => usePdfDownload({ endpoint: '/api/x/', title: 'Q3' }));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.download();
    });

    expect(outcome).toBe(true);
  });

  it('resolves false when the PDF request fails, without throwing', async () => {
    mockApiPostBinary.mockRejectedValue(new Error('500'));
    const { result } = renderHook(() => usePdfDownload({ endpoint: '/api/x/', title: 'Q3' }));

    let outcome: boolean | undefined;
    await act(async () => {
      outcome = await result.current.download();
    });

    expect(outcome).toBe(false);
  });
});
