/**
 * CommentIcon Component Tests
 *
 * Tests for the comment icon indicator states:
 * - none: plain icon, no indicator
 * - unread: filled red dot
 * - read: outlined red dot
 * - mentioned: red badge with @ symbol
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { CommentIcon } from '../comment-icon';

describe('CommentIcon', () => {
  it('renders the base icon for "none" state', () => {
    const { container } = render(<CommentIcon state="none" />);
    // Icon should render but no indicator badges
    expect(screen.queryByTestId('comment-mention-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-dot-unread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-dot-outline')).not.toBeInTheDocument();
    // SVG icon should still be present
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a filled dot for "unread" state', () => {
    render(<CommentIcon state="unread" />);
    expect(screen.getByTestId('comment-dot-unread')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-mention-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-dot-outline')).not.toBeInTheDocument();
  });

  it('renders an outlined dot for "read" state', () => {
    render(<CommentIcon state="read" />);
    expect(screen.getByTestId('comment-dot-outline')).toBeInTheDocument();
    expect(screen.queryByTestId('comment-mention-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-dot-unread')).not.toBeInTheDocument();
  });

  it('renders an @ badge for "mentioned" state', () => {
    render(<CommentIcon state="mentioned" />);
    const badge = screen.getByTestId('comment-mention-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('@');
    expect(screen.queryByTestId('comment-dot-unread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('comment-dot-outline')).not.toBeInTheDocument();
  });

  it('applies custom className to the icon', () => {
    const { container } = render(<CommentIcon state="none" className="text-primary" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('text-primary');
  });
});
