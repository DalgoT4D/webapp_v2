import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChartBuilderLayout } from '@/components/charts/builder/ChartBuilderLayout';

function renderLayout(
  builder: 'create' | 'edit',
  extra: Partial<Parameters<typeof ChartBuilderLayout>[0]> = {}
) {
  const onConfigTabChange = jest.fn();
  const onPreviewTabChange = jest.fn();
  const utils = render(
    <ChartBuilderLayout
      builder={builder}
      header={<div>HEADER</div>}
      onConfigTabChange={onConfigTabChange}
      dataConfigPanel={<div>DATA-CONFIG</div>}
      stylingPanel={<div>STYLING</div>}
      previewTab="chart"
      onPreviewTabChange={onPreviewTabChange}
      chartPanel={<div>CHART-PANEL</div>}
      dataPanel={<div>DATA-PANEL</div>}
      dialogs={<div>DIALOGS</div>}
      {...extra}
    />
  );
  return { ...utils, onConfigTabChange, onPreviewTabChange };
}

describe('ChartBuilderLayout', () => {
  it('renders header, both panels, the chart panel and dialogs with the shared testids', () => {
    renderLayout('create', { configTabValue: 'configuration' });
    for (const text of ['HEADER', 'DATA-CONFIG', 'CHART-PANEL', 'DIALOGS']) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    for (const id of [
      'chart-config-tabs',
      'chart-data-config-tab',
      'chart-styling-tab',
      'chart-preview-tab-chart',
      'chart-preview-tab-data',
    ]) {
      expect(screen.getByTestId(id)).toBeInTheDocument();
    }
  });

  it('keeps the per-page frame classes', () => {
    const { container: create } = renderLayout('create');
    expect(create.firstChild).toHaveClass('min-h-screen', 'bg-gray-50');
    const { container: edit } = renderLayout('edit');
    expect(edit.firstChild).toHaveClass(
      'h-full',
      'flex',
      'flex-col',
      'overflow-hidden',
      'bg-gray-50'
    );
  });

  it('reports tab changes', async () => {
    const { onConfigTabChange, onPreviewTabChange } = renderLayout('edit');
    await userEvent.click(screen.getByTestId('chart-styling-tab'));
    expect(onConfigTabChange).toHaveBeenCalledWith('styling');
    await userEvent.click(screen.getByTestId('chart-preview-tab-data'));
    expect(onPreviewTabChange).toHaveBeenCalledWith('data');
  });

  it('draws the overlay before the chart panel', () => {
    renderLayout('edit', { chartOverlay: <div>OVERLAY</div> });
    const overlay = screen.getByText('OVERLAY');
    expect(
      overlay.compareDocumentPosition(screen.getByText('CHART-PANEL')) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});
