import { act, renderHook } from '@testing-library/react';
import type { ChartPagination } from '@/types/charts';
import { usePreviewPagination } from '../usePreviewPagination';

describe('usePreviewPagination', () => {
  it('starts the data preview at 20 rows on create and 25 on edit (C-E7)', () => {
    const create = renderHook(() => usePreviewPagination('create', undefined));
    const edit = renderHook(() => usePreviewPagination('edit', undefined));
    expect(create.result.current.dataPreview.pageSize).toBe(20);
    expect(edit.result.current.dataPreview.pageSize).toBe(25);
    for (const { result } of [create, edit]) {
      expect(result.current.rawData).toMatchObject({ page: 1, pageSize: 20 });
      expect(result.current.tableChart).toMatchObject({ page: 1, pageSize: 20 });
    }
  });

  it('goes back to page 1 when the page size changes', () => {
    const { result } = renderHook(() => usePreviewPagination('create', undefined));
    act(() => result.current.rawData.setPage(3));
    act(() => result.current.rawData.changePageSize(50));
    expect(result.current.rawData).toMatchObject({ page: 1, pageSize: 50 });
  });

  it('resets the table chart page', () => {
    const { result } = renderHook(() => usePreviewPagination('edit', undefined));
    act(() => result.current.tableChart.setPage(4));
    act(() => result.current.resetTableChartPage());
    expect(result.current.tableChart.page).toBe(1);
  });

  it('edit only: a row-limit change puts the data preview back to 25 rows, page 1', () => {
    const run = (builder: 'create' | 'edit') => {
      const hook = renderHook(
        ({ pagination }: { pagination?: ChartPagination }) =>
          usePreviewPagination(builder, pagination),
        { initialProps: { pagination: { enabled: false, page_size: 50 } } }
      );
      act(() => hook.result.current.dataPreview.changePageSize(100));
      act(() => hook.result.current.dataPreview.setPage(2));
      hook.rerender({ pagination: { enabled: true, page_size: 50 } });
      return hook.result.current.dataPreview;
    };
    expect(run('edit')).toMatchObject({ page: 1, pageSize: 25 });
    expect(run('create')).toMatchObject({ page: 2, pageSize: 100 });
  });
});
