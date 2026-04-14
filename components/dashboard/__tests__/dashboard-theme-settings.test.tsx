import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DashboardThemeSettings } from '../dashboard-theme-settings';
import { Dialog, DialogContent } from '@/components/ui/dialog';

jest.mock('react-colorful', () => ({
  HexAlphaColorPicker: ({
    color,
    onChange,
    'data-testid': dataTestId,
    ...props
  }: {
    color: string;
    onChange: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <input
      {...props}
      data-testid={dataTestId || 'hex-alpha-color-picker'}
      value={color}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  HexColorPicker: ({
    color,
    onChange,
    'data-testid': dataTestId,
    ...props
  }: {
    color: string;
    onChange: (value: string) => void;
    'data-testid'?: string;
  }) => (
    <input
      {...props}
      data-testid={dataTestId || 'hex-color-picker'}
      value={color}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  HexColorInput: ({
    color,
    onChange,
    alpha: _alpha,
    prefixed: _prefixed,
    ...props
  }: {
    color: string;
    onChange: (value: string) => void;
    alpha?: boolean;
    prefixed?: boolean;
  }) => {
    void _alpha;
    void _prefixed;

    return <input {...props} value={color} onChange={(event) => onChange(event.target.value)} />;
  },
}));

function renderSettings(component: React.ReactNode) {
  return render(
    <Dialog open>
      <DialogContent showCloseButton={false} aria-describedby={undefined}>
        {component}
      </DialogContent>
    </Dialog>
  );
}

describe('DashboardThemeSettings', () => {
  it('saves the normalized background theme and clears overlay fields', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(true);

    renderSettings(
      <DashboardThemeSettings
        currentTheme={{
          theme_background_color: '#11223380',
          theme_background_image_url: 'https://example.com/background.jpg',
          theme_background_image_blur: 8,
          theme_chart_opacity: 0.72,
          theme_overlay_color: '#0f172a',
          theme_overlay_opacity: 0.4,
        }}
        onSave={onSave}
      />
    );

    expect(screen.getByTestId('dashboard-background-preview')).toBeInTheDocument();

    await user.click(screen.getByTestId('dashboard-background-save-btn'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        theme_background_color: '#11223380',
        theme_background_gradient: null,
        theme_background_image_url: 'https://example.com/background.jpg',
        theme_background_image_blur: 8,
        theme_chart_opacity: 0.72,
        theme_overlay_color: null,
        theme_overlay_opacity: 0,
      });
    });
  });

  it('switches to a gradient preset and includes a background image when saved', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue(true);

    renderSettings(
      <DashboardThemeSettings
        currentTheme={{
          theme_background_color: '#ffffffff',
          theme_chart_opacity: 1,
        }}
        onSave={onSave}
      />
    );

    await user.click(screen.getByTestId('dashboard-background-fill-gradient-btn'));
    await user.click(screen.getByTestId('dashboard-background-gradient-preset-aurora-btn'));
    await user.type(
      screen.getByTestId('dashboard-background-image-input'),
      'https://example.com/pattern.jpg'
    );
    await user.click(screen.getByTestId('dashboard-background-save-btn'));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        theme_background_color: null,
        theme_background_gradient: {
          type: 'linear',
          direction: '135deg',
          colors: ['#dcfce7ff', '#cffafeff'],
        },
        theme_background_image_url: 'https://example.com/pattern.jpg',
        theme_background_image_blur: 0,
        theme_chart_opacity: 1,
        theme_overlay_color: null,
        theme_overlay_opacity: 0,
      });
    });
  });
});
