import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { trackEvent } from '@/lib/analytics';
import { ANALYTICS_EVENTS } from '@/constants/analytics';
import { mockApiPut, mockApiDelete, resetApiMocks } from '@/test-utils/api';
import {
  DASHBOARD_RICH_TEXT_FLUSH_EVENT,
  DASHBOARD_WIDGET_DRAG_START_EVENT,
  UnifiedTextElement,
  type UnifiedTextConfig,
} from '../text-element-unified';

jest.mock('@/lib/analytics', () => ({ trackEvent: jest.fn() }));

const mockToastErrorApi = jest.fn();
jest.mock('@/lib/toast', () => ({
  toastError: { api: (...args: unknown[]) => mockToastErrorApi(...args) },
}));

const mockTrackEvent = trackEvent as jest.MockedFunction<typeof trackEvent>;

const config: UnifiedTextConfig = {
  content: 'Original',
  type: 'paragraph',
  fontSize: 16,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'left',
  color: '#000000',
};

const configWithImage: UnifiedTextConfig = {
  ...config,
  imageUrl: 'https://bucket.s3.amazonaws.com/orgs/org/dashboards/images/old.png',
  imageKey: 'orgs/org/dashboards/images/old.png',
  imageName: 'old.png',
};

/**
 * Clicks into the editor and waits until it is genuinely ready for keystrokes.
 *
 * startEditing measures the floating toolbar inside a requestAnimationFrame, and the
 * setToolbarPosition that follows re-renders the editor. Characters typed in that window are
 * swallowed by ProseMirror, so waiting only on `contenteditable` leaves the typing tests
 * racing the animation frame.
 */
async function activateEditor(editor: HTMLElement) {
  fireEvent.click(editor);
  await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'));
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

describe('UnifiedTextElement', () => {
  beforeAll(() => {
    // ProseMirror asks the active DOM range for geometry when it scrolls a
    // changed selection into view. JSDOM does not implement those methods.
    Range.prototype.getClientRects = jest.fn(() => {
      const rects: DOMRect[] = [];
      return Object.assign(rects, { item: (): DOMRect | null => null }) as unknown as DOMRectList;
    });
    Range.prototype.getBoundingClientRect = jest.fn(() => new DOMRect());
    document.elementFromPoint = jest.fn(() => null);
  });

  beforeEach(() => {
    resetApiMocks(); // clears every jest.fn(), including mockTrackEvent/mockToastErrorApi
    mockApiDelete.mockResolvedValue({ success: true });
  });

  // Both events carry dashboard_id so rich-text usage can be joined to its dashboard;
  // the id arrives as a prop threaded down from the builder via DashboardCell.
  it('tracks editing sessions and successful formatting actions with the dashboard id', async () => {
    const user = userEvent.setup();
    render(<UnifiedTextElement config={config} onUpdate={jest.fn()} isEditMode dashboardId={7} />);

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    fireEvent.click(editor);
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'));
    expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_RICH_TEXT_EDIT_STARTED, {
      dashboard_id: 7,
    });

    await user.click(screen.getByRole('button', { name: 'Text style' }));
    await user.click(screen.getByRole('button', { name: 'Heading 1' }));
    expect(mockTrackEvent).toHaveBeenCalledWith(
      ANALYTICS_EVENTS.DASHBOARD_RICH_TEXT_FORMAT_APPLIED,
      { dashboard_id: 7, format_type: 'heading' }
    );
  });

  it('ignores malformed dashboard flush events without ending the edit session', async () => {
    render(
      <UnifiedTextElement config={config} componentId="text-1" onUpdate={jest.fn()} isEditMode />
    );

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    fireEvent.click(editor);
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'));

    expect(() =>
      act(() => document.dispatchEvent(new CustomEvent(DASHBOARD_RICH_TEXT_FLUSH_EVENT)))
    ).not.toThrow();
    expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  it('flushes active rich-text changes before its widget starts dragging', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(
      <UnifiedTextElement config={config} componentId="text-1" onUpdate={onUpdate} isEditMode />
    );

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    await user.click(editor);
    await waitFor(() => expect(editor).toHaveAttribute('contenteditable', 'true'));
    // Give ProseMirror one tick to finish attaching key handlers before typing —
    // without this JSDOM would occasionally drop the first character or two.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await user.type(editor, ' updated');

    act(() => {
      document.dispatchEvent(
        new CustomEvent(DASHBOARD_WIDGET_DRAG_START_EVENT, {
          detail: { componentId: 'text-1' },
        })
      );
    });

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('updated'),
          richText: expect.objectContaining({ type: 'doc' }),
        })
      )
    );
  });

  it('flushes synchronously when the dashboard is about to save or navigate', async () => {
    const user = userEvent.setup();
    render(
      <UnifiedTextElement config={config} componentId="text-1" onUpdate={jest.fn()} isEditMode />
    );

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    await activateEditor(editor);
    await user.type(editor, ' keyboard edit', { skipClick: true });
    const detail = { updates: [] };

    act(() => {
      document.dispatchEvent(new CustomEvent(DASHBOARD_RICH_TEXT_FLUSH_EVENT, { detail }));
    });

    expect(detail.updates).toEqual([
      expect.objectContaining({
        componentId: 'text-1',
        config: expect.objectContaining({
          content: expect.stringContaining('edit'),
          richText: expect.objectContaining({ type: 'doc' }),
        }),
      }),
    ]);
  });

  it('commits active rich-text changes when keyboard focus leaves the editor', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(
      <>
        <UnifiedTextElement config={config} componentId="text-1" onUpdate={onUpdate} isEditMode />
        <button type="button" data-testid="outside-rich-text-editor">
          Outside editor
        </button>
      </>
    );

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    await activateEditor(editor);
    await user.click(editor);
    await user.type(editor, ' blurred', { skipClick: true });
    expect(editor).toHaveTextContent('blurred');
    act(() => screen.getByRole('button', { name: 'Text style' }).focus());
    expect(onUpdate).not.toHaveBeenCalled();
    act(() => screen.getByTestId('outside-rich-text-editor').focus());

    await waitFor(() =>
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('blurred') })
      )
    );
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(editor).toHaveAttribute('contenteditable', 'false');
  });

  it('commits only once when an outside click causes both pointer and focus transitions', async () => {
    const user = userEvent.setup();
    const onUpdate = jest.fn();
    render(
      <>
        <UnifiedTextElement config={config} componentId="text-1" onUpdate={onUpdate} isEditMode />
        <button type="button" data-testid="outside-click-target">
          Outside editor
        </button>
      </>
    );

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    await activateEditor(editor);
    await user.click(editor);
    await user.type(editor, ' once', { skipClick: true });
    await user.click(screen.getByTestId('outside-click-target'));

    await waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ content: expect.stringContaining('once') })
    );
  });

  it('renders the color choices in a fixed-width picker', async () => {
    const user = userEvent.setup();
    render(<UnifiedTextElement config={config} onUpdate={jest.fn()} isEditMode />);

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    fireEvent.click(editor);
    await user.click(await screen.findByRole('button', { name: 'Text color' }));

    expect(screen.getByText('Text color')).toBeInTheDocument();
    expect(screen.getByLabelText('Custom text color').closest('div')).toHaveClass('w-40');
    expect(screen.getAllByRole('button', { name: /Set text color/ })).toHaveLength(8);
  });

  it('shows the font-size placeholder when the selected size is not an exact option', async () => {
    const fractionalSizeConfig: UnifiedTextConfig = {
      ...config,
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Fractional size',
                marks: [{ type: 'textStyle', attrs: { fontSize: '12.5px' } }],
              },
            ],
          },
        ],
      },
    };
    render(<UnifiedTextElement config={fractionalSizeConfig} onUpdate={jest.fn()} isEditMode />);

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    fireEvent.click(editor);

    expect(await screen.findByTestId('rich-text-font-size')).toHaveValue('');
  });

  it('can turn bold off for text typed after an existing bold run', async () => {
    const user = userEvent.setup();
    const boldConfig: UnifiedTextConfig = {
      ...config,
      content: 'Bold part',
      richText: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { textAlign: 'left' },
            content: [{ type: 'text', text: 'Bold part', marks: [{ type: 'bold' }] }],
          },
        ],
      },
    };
    render(<UnifiedTextElement config={boldConfig} onUpdate={jest.fn()} isEditMode />);

    const editor = await screen.findByTestId('dashboard-rich-text-editor');
    await activateEditor(editor);
    const boldButton = await screen.findByRole('button', { name: 'Bold' });

    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.focus(editor);
    fireEvent(document, new Event('selectionchange'));

    await waitFor(() => expect(boldButton).toHaveAttribute('aria-pressed', 'true'));

    await user.click(boldButton);
    await user.type(editor, ' normal', { skipClick: true });

    expect(editor.innerHTML).toContain('<strong>Bold part</strong> normal');
  });

  it.each([
    { level: 1, sizeClass: '[&_h1]:text-[32px]', weightClass: '[&_h1]:font-bold' },
    { level: 2, sizeClass: '[&_h2]:text-[26px]', weightClass: '[&_h2]:font-bold' },
    { level: 3, sizeClass: '[&_h3]:text-[22px]', weightClass: '[&_h3]:font-semibold' },
  ])(
    'applies visible H$level typography and removes the legacy inline font size',
    async ({ level, sizeClass, weightClass }) => {
      const user = userEvent.setup();
      render(<UnifiedTextElement config={config} onUpdate={jest.fn()} isEditMode />);

      const editor = await screen.findByTestId('dashboard-rich-text-editor');
      fireEvent.click(editor);
      await user.click(await screen.findByRole('button', { name: 'Text style' }));
      await user.click(await screen.findByRole('button', { name: `Heading ${level}` }));

      expect(editor.querySelector(`h${level}`)).not.toBeNull();
      expect(editor).toHaveClass(sizeClass, weightClass);
      expect(editor.innerHTML).not.toContain('font-size: 16px');
    }
  );

  describe('widget image upload/replace/remove', () => {
    function selectFile(input: HTMLElement, file: File) {
      fireEvent.change(input, { target: { files: [file] } });
    }

    it('uploads a new image and applies the returned url/key to the widget', async () => {
      mockApiPut.mockResolvedValueOnce({
        image_url: 'https://bucket.s3.amazonaws.com/new.png',
        image_key: 'orgs/org/dashboards/images/new.png',
      });
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={config} onUpdate={onUpdate} isEditMode />);

      const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
      selectFile(screen.getByTestId('rich-text-image-file-input'), file);

      await waitFor(() =>
        expect(onUpdate).toHaveBeenCalledWith(
          expect.objectContaining({
            imageUrl: 'https://bucket.s3.amazonaws.com/new.png',
            imageKey: 'orgs/org/dashboards/images/new.png',
            imageName: 'photo.png',
          })
        )
      );
      expect(mockApiPut).toHaveBeenCalledWith('/api/dashboards/images/', expect.any(FormData));
      expect(mockApiDelete).not.toHaveBeenCalled(); // no previous image to clean up
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_ADDED, {
        source: 'upload',
      });
    });

    it('deletes the previous S3 image after successfully replacing it with a new upload', async () => {
      mockApiPut.mockResolvedValueOnce({
        image_url: 'https://bucket.s3.amazonaws.com/new.png',
        image_key: 'orgs/org/dashboards/images/new.png',
      });
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={configWithImage} onUpdate={onUpdate} isEditMode />);

      const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
      selectFile(screen.getByTestId('rich-text-image-file-input'), file);

      await waitFor(() =>
        expect(mockApiDelete).toHaveBeenCalledWith('/api/dashboards/images/', {
          body: JSON.stringify({ image_key: configWithImage.imageKey }),
        })
      );
    });

    it('rejects an oversized file without calling the upload API', async () => {
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={config} onUpdate={onUpdate} isEditMode />);

      const oversizedFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', {
        type: 'image/png',
      });
      selectFile(screen.getByTestId('rich-text-image-file-input'), oversizedFile);

      await waitFor(() =>
        expect(mockToastErrorApi).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Image must be smaller than 5MB.' })
        )
      );
      expect(mockApiPut).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('rejects a disallowed file type without calling the upload API', async () => {
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={config} onUpdate={onUpdate} isEditMode />);

      const badFile = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
      selectFile(screen.getByTestId('rich-text-image-file-input'), badFile);

      await waitFor(() =>
        expect(mockToastErrorApi).toHaveBeenCalledWith(
          expect.objectContaining({ message: 'Please upload a JPEG, PNG, GIF, or WEBP image.' })
        )
      );
      expect(mockApiPut).not.toHaveBeenCalled();
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('shows an error toast and keeps the widget unchanged when the upload API call fails', async () => {
      mockApiPut.mockRejectedValueOnce(new Error('network down'));
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={config} onUpdate={onUpdate} isEditMode />);

      const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });
      selectFile(screen.getByTestId('rich-text-image-file-input'), file);

      await waitFor(() =>
        expect(mockToastErrorApi).toHaveBeenCalledWith(
          expect.any(Error),
          'Failed to upload image. Please try again.'
        )
      );
      expect(onUpdate).not.toHaveBeenCalled();
    });

    it('deletes the S3 image and clears the widget when the image is removed', async () => {
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={configWithImage} onUpdate={onUpdate} isEditMode />);

      const editor = await screen.findByTestId('dashboard-rich-text-editor');
      await activateEditor(editor);

      await userEvent.click(screen.getByTestId('rich-text-image'));
      await userEvent.click(await screen.findByTestId('rich-text-image-remove'));

      expect(mockApiDelete).toHaveBeenCalledWith('/api/dashboards/images/', {
        body: JSON.stringify({ image_key: configWithImage.imageKey }),
      });
      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: undefined,
          imageKey: undefined,
          imageName: undefined,
        })
      );
      expect(mockTrackEvent).toHaveBeenCalledWith(ANALYTICS_EVENTS.DASHBOARD_TEXT_IMAGE_REMOVED);
    });

    it('switching to an external image link clears the S3 imageKey and deletes the old S3 object', async () => {
      const onUpdate = jest.fn();
      render(<UnifiedTextElement config={configWithImage} onUpdate={onUpdate} isEditMode />);

      const editor = await screen.findByTestId('dashboard-rich-text-editor');
      await activateEditor(editor);

      await userEvent.click(screen.getByTestId('rich-text-image'));
      await userEvent.click(await screen.findByTestId('rich-text-image-reload'));
      await userEvent.click(await screen.findByTestId('rich-text-image-tab-link'));
      await userEvent.type(
        await screen.findByTestId('rich-text-image-link-input'),
        'https://example.com/pic.png'
      );
      await userEvent.click(await screen.findByTestId('rich-text-image-link-confirm'));

      expect(onUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          imageUrl: 'https://example.com/pic.png',
          imageKey: undefined,
          imageName: 'pic.png',
        })
      );
      expect(mockApiDelete).toHaveBeenCalledWith('/api/dashboards/images/', {
        body: JSON.stringify({ image_key: configWithImage.imageKey }),
      });
    });
  });
});
