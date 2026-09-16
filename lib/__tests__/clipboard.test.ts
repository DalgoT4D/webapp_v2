import { copyUrlToClipboard } from '../clipboard';

jest.mock('@/lib/toast', () => ({
  toastSuccess: { generic: jest.fn() },
  toastError: { api: jest.fn() },
}));

const mockWriteText = jest.fn();

beforeAll(() => {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: (text: string) => mockWriteText(text) },
    configurable: true,
  });
});

beforeEach(() => jest.clearAllMocks());

// The boolean return is what lets callers avoid reporting a share the user never got:
// clipboard writes fail in practice (denied permission, non-secure context, lost focus)
// and this helper reports that with a toast rather than by throwing.
describe('copyUrlToClipboard', () => {
  it('returns true when the copy succeeds', async () => {
    mockWriteText.mockResolvedValue(undefined);

    await expect(copyUrlToClipboard('https://x/share/tok')).resolves.toBe(true);
    expect(mockWriteText).toHaveBeenCalledWith('https://x/share/tok');
  });

  it('returns false when the clipboard write is rejected, without throwing', async () => {
    mockWriteText.mockRejectedValue(new Error('NotAllowedError'));

    await expect(copyUrlToClipboard('https://x/share/tok')).resolves.toBe(false);
  });
});
