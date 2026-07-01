import React from 'react';
import { render, screen } from '@testing-library/react';
import { OrgBrand } from '../org-brand';

describe('OrgBrand', () => {
  it('renders img when logoUrl is provided', () => {
    render(<OrgBrand logoUrl="https://example.com/logo.png" name="Acme" />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/logo.png');
  });

  it('renders org name as fallback when no logoUrl', () => {
    render(<OrgBrand logoUrl={null} name="Acme" />);
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders nothing when both logoUrl and name are absent', () => {
    const { container } = render(<OrgBrand />);
    expect(container.firstChild).toBeNull();
  });
});
