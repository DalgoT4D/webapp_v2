import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnifiedTextElement, type UnifiedTextConfig } from '../text-element-unified';

jest.mock('@/lib/chart-size-constraints', () => ({
  calculateTextDimensions: jest.fn().mockReturnValue({ width: 240, height: 160 }),
}));

jest.mock('react-colorful', () => ({
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
}));

const baseConfig: UnifiedTextConfig = {
  content: 'Dashboard note',
  type: 'paragraph',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  color: '#111827',
};

describe('UnifiedTextElement', () => {
  beforeAll(() => {
    window.requestAnimationFrame = (callback: FrameRequestCallback) =>
      window.setTimeout(callback, 0);
  });

  it('updates the saved config when the user selects a new font', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();

    render(<UnifiedTextElement config={baseConfig} onUpdate={onUpdate} />);

    await user.click(screen.getByTestId('dashboard-text-content'));
    await screen.findByTestId('dashboard-text-toolbar');
    await user.selectOptions(screen.getByTestId('dashboard-text-font-select'), 'playfair-display');

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        ...baseConfig,
        fontFamily: 'playfair-display',
        contentConstraints: {
          minWidth: 240,
          minHeight: 160,
        },
      });
    });
  });

  it('saves fill changes and applies them to the textbox surface', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    const { rerender } = render(<UnifiedTextElement config={baseConfig} onUpdate={onUpdate} />);

    await user.click(screen.getByTestId('dashboard-text-content'));
    await screen.findByTestId('dashboard-text-toolbar');
    await user.click(screen.getByTestId('dashboard-text-fill-btn'));
    await user.click(screen.getByTestId('dashboard-text-fill-preset-light-blue'));

    await waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith({
        ...baseConfig,
        backgroundColor: '#DBEAFE',
        contentConstraints: {
          minWidth: 240,
          minHeight: 160,
        },
      });
    });

    rerender(
      <UnifiedTextElement
        config={{ ...baseConfig, backgroundColor: '#DBEAFE' }}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByTestId('dashboard-text-edit-surface')).toHaveStyle(
      'background-color: rgb(219, 234, 254)'
    );
  });
});
