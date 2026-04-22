import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_IMAGE_FIT_MODE, ImageElement, type ImageComponentConfig } from '../image-element';

const baseConfig: ImageComponentConfig = {
  imageUrl: 'data:image/png;base64,ZmFrZQ==',
  alt: 'Dashboard hero',
  objectFit: 'cover',
};

describe('ImageElement', () => {
  it('uses the saved fit mode in dashboard view mode', () => {
    render(<ImageElement config={baseConfig} onUpdate={jest.fn()} isEditMode={false} />);

    expect(screen.getByTestId('dashboard-image-view-preview')).toHaveStyle('object-fit: cover');
  });

  it('renders the on-canvas preview in edit mode using the selected fit mode', () => {
    render(<ImageElement config={baseConfig} onUpdate={jest.fn()} />);

    expect(screen.getByTestId('dashboard-image-edit-preview')).toHaveStyle('object-fit: cover');
  });

  it('falls back to the default fit mode when no fit mode is saved', () => {
    render(
      <ImageElement
        config={{ imageUrl: baseConfig.imageUrl, alt: baseConfig.alt }}
        onUpdate={jest.fn()}
        isEditMode={false}
      />
    );

    expect(screen.getByTestId('dashboard-image-view-preview')).toHaveStyle(
      `object-fit: ${DEFAULT_IMAGE_FIT_MODE}`
    );
  });

  it('updates the saved config when the user chooses a different fit mode', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();

    render(<ImageElement config={baseConfig} onUpdate={onUpdate} />);

    await user.click(screen.getByTestId('dashboard-image-fit-select-trigger'));
    await user.click(screen.getByRole('option', { name: 'Fit' }));

    expect(onUpdate).toHaveBeenCalledWith({
      ...baseConfig,
      objectFit: 'contain',
    });
  });
});
