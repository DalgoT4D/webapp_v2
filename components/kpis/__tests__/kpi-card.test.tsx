import { render, screen } from '@testing-library/react';
import { KPICard, type KPICardData } from '../kpi-card';

jest.mock('echarts', () => ({
  init: () => ({ setOption: jest.fn(), resize: jest.fn(), dispose: jest.fn() }),
}));

const baseData: KPICardData = {
  currentValue: 1,
  targetValue: 15,
  ragStatus: null,
  popChange: null,
  direction: 'increase',
  timeGrain: 'weekly',
  echartsConfig: null,
  dataLastDate: '2026-05-18',
  updatedAt: '2026-05-18T00:00:00Z',
  isLoading: false,
};

describe('KPICard created_by', () => {
  it('shows the creator email below the name when provided', () => {
    render(<KPICard name="Support tickets count" createdBy="alice@org.com" data={baseData} />);
    expect(screen.getByTestId('kpi-card-created-by')).toHaveTextContent(
      'Created by: alice@org.com'
    );
  });

  it('omits the created-by label when not provided', () => {
    render(<KPICard name="Support tickets count" data={baseData} />);
    expect(screen.queryByTestId('kpi-card-created-by')).toBeNull();
  });
});
