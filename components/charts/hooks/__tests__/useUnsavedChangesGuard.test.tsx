import { act, renderHook } from '@testing-library/react';
import { useUnsavedChangesGuard } from '@/components/charts/hooks/useUnsavedChangesGuard';

function fireBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
  window.dispatchEvent(event);
  return event;
}

describe('useUnsavedChangesGuard', () => {
  it('blocks unload only while there are unsaved changes', () => {
    const { rerender } = renderHook(({ dirty }) => useUnsavedChangesGuard(dirty), {
      initialProps: { dirty: true },
    });
    expect(fireBeforeUnload().defaultPrevented).toBe(true);
    rerender({ dirty: false });
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('removes the listener on unmount', () => {
    const { unmount } = renderHook(() => useUnsavedChangesGuard(true));
    unmount();
    expect(fireBeforeUnload().defaultPrevented).toBe(false);
  });

  it('tracks the leave target', () => {
    const { result } = renderHook(() => useUnsavedChangesGuard(true));
    expect(result.current.leaveTarget).toBeNull();
    act(() => result.current.askToLeave('/charts/new'));
    expect(result.current.leaveTarget).toBe('/charts/new');
    act(() => result.current.closeLeavePrompt());
    expect(result.current.leaveTarget).toBeNull();
  });
});
