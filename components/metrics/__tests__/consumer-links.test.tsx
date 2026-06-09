import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConsumerLinks } from '../consumer-links';
import type { MetricConsumersResponse } from '@/types/metrics';

describe('ConsumerLinks', () => {
  it('shows "unused" when no consumers', () => {
    const consumers: MetricConsumersResponse = { charts: [], kpis: [] };
    render(<ConsumerLinks consumers={consumers} />);
    expect(screen.getByText('unused')).toBeInTheDocument();
  });

  it('shows chart count when only charts', () => {
    const consumers: MetricConsumersResponse = {
      charts: [{ id: 1, title: 'Chart A', chart_type: 'bar' }],
      kpis: [],
    };
    render(<ConsumerLinks consumers={consumers} />);
    expect(screen.getByText('1 Chart')).toBeInTheDocument();
  });

  it('shows KPI count when only KPIs', () => {
    const consumers: MetricConsumersResponse = {
      charts: [],
      kpis: [{ id: 1, name: 'KPI A' }],
    };
    render(<ConsumerLinks consumers={consumers} />);
    expect(screen.getByText('1 KPI')).toBeInTheDocument();
  });

  it('shows both counts with comma separator', () => {
    const consumers: MetricConsumersResponse = {
      charts: [
        { id: 1, title: 'Chart A', chart_type: 'bar' },
        { id: 2, title: 'Chart B', chart_type: 'line' },
      ],
      kpis: [{ id: 1, name: 'KPI A' }],
    };
    render(<ConsumerLinks consumers={consumers} />);
    expect(screen.getByText('2 Charts')).toBeInTheDocument();
    expect(screen.getByText('1 KPI')).toBeInTheDocument();
    expect(screen.getByText(',')).toBeInTheDocument();
  });

  it('pluralizes correctly', () => {
    const consumers: MetricConsumersResponse = {
      charts: [{ id: 1, title: 'A', chart_type: 'bar' }],
      kpis: [
        { id: 1, name: 'KPI A' },
        { id: 2, name: 'KPI B' },
        { id: 3, name: 'KPI C' },
      ],
    };
    render(<ConsumerLinks consumers={consumers} />);
    expect(screen.getByText('1 Chart')).toBeInTheDocument();
    expect(screen.getByText('3 KPIs')).toBeInTheDocument();
  });

  it('shows popover with item names on click', async () => {
    const user = userEvent.setup();
    const consumers: MetricConsumersResponse = {
      charts: [
        { id: 1, title: 'Revenue Chart', chart_type: 'bar' },
        { id: 2, title: 'Trend Chart', chart_type: 'line' },
      ],
      kpis: [],
    };
    render(<ConsumerLinks consumers={consumers} />);

    await user.click(screen.getByText('2 Charts'));
    expect(screen.getByText('Revenue Chart')).toBeInTheDocument();
    expect(screen.getByText('Trend Chart')).toBeInTheDocument();
  });

  it('renders links with target="_blank"', async () => {
    const user = userEvent.setup();
    const consumers: MetricConsumersResponse = {
      charts: [{ id: 42, title: 'My Chart', chart_type: 'bar' }],
      kpis: [],
    };
    render(<ConsumerLinks consumers={consumers} />);

    await user.click(screen.getByText('1 Chart'));
    const link = screen.getByText('My Chart');
    expect(link.closest('a')).toHaveAttribute('href', '/charts/42');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  it('uses amber color in inherit variant', () => {
    const consumers: MetricConsumersResponse = {
      charts: [{ id: 1, title: 'Chart', chart_type: 'bar' }],
      kpis: [],
    };
    render(<ConsumerLinks consumers={consumers} variant="inherit" />);
    const button = screen.getByText('1 Chart');
    expect(button).toHaveClass('text-amber-700');
  });
});
