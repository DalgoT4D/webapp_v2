/**
 * Tests for WorkInProgress component
 * Tests WIP message display and back button functionality
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WorkInProgress } from '../WorkInProgress';

describe('WorkInProgress', () => {
  it('should render all UI elements and handle button variants correctly', async () => {
    const user = userEvent.setup();
    const { container, rerender } = render(<WorkInProgress />);

    // Heading, description, and icon
    expect(screen.getByText('Map Charts Coming Soon')).toBeInTheDocument();
    expect(
      screen.getByText(/Geographic visualizations are currently in development/i)
    ).toBeInTheDocument();
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();

    // No back button when onBack is not provided
    expect(
      screen.queryByRole('button', { name: /choose another chart type/i })
    ).not.toBeInTheDocument();

    // Render back button when onBack is provided
    const mockOnBack = jest.fn();
    rerender(<WorkInProgress onBack={mockOnBack} />);
    expect(screen.getByRole('button', { name: /choose another chart type/i })).toBeInTheDocument();

    // Handle back button clicks correctly
    const backButton = screen.getByRole('button', { name: /choose another chart type/i });
    await user.click(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(1);

    await user.click(backButton);
    expect(mockOnBack).toHaveBeenCalledTimes(2);

    // Component variants - test different onBack prop values
    rerender(<WorkInProgress />);
    expect(screen.getByText('Map Charts Coming Soon')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /choose another chart type/i })
    ).not.toBeInTheDocument();

    rerender(<WorkInProgress onBack={mockOnBack} />);
    expect(screen.getByText('Map Charts Coming Soon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose another chart type/i })).toBeInTheDocument();

    rerender(<WorkInProgress onBack={undefined} />);
    expect(screen.getByText('Map Charts Coming Soon')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /choose another chart type/i })
    ).not.toBeInTheDocument();
  });

  it('should meet accessibility requirements and support keyboard navigation', async () => {
    const user = userEvent.setup();
    const mockOnBack = jest.fn();
    render(<WorkInProgress onBack={mockOnBack} />);

    // Accessible button label
    const backButton = screen.getByRole('button', { name: /choose another chart type/i });
    expect(backButton).toBeInTheDocument();

    // Keyboard navigation
    await user.tab();
    expect(backButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(mockOnBack).toHaveBeenCalledTimes(1);
  });
});
