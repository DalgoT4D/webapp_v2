import type { RefObject } from 'react';

/** Wait for the new widget to render before measuring it. */
const SCROLL_AFTER_INSERT_MS = 100;
/** Space left between the widget and the canvas edge after scrolling. */
const SCROLL_PADDING_PX = 20;

/** Smart scroll — only scrolls if the widget is actually out of view. */
export function scrollToWidgetIfNeeded(
  canvasRef: RefObject<HTMLDivElement | null>,
  dashboardContainerRef: RefObject<HTMLDivElement | null>,
  componentId: string
) {
  setTimeout(() => {
    if (!canvasRef.current || !dashboardContainerRef.current) return;

    const canvas = canvasRef.current;

    // Find the newly added component element
    const componentElement = canvas.querySelector(`[data-component-id="${componentId}"]`);
    if (!componentElement) return;

    // Get container and component positions
    const canvasRect = canvas.getBoundingClientRect();
    const componentRect = componentElement.getBoundingClientRect();

    // Check if component is actually outside the visible area
    const isComponentBelowView = componentRect.bottom > canvasRect.bottom;
    const isComponentAboveView = componentRect.top < canvasRect.top;

    // Only scroll if there's actual content to scroll and component is out of view
    const hasScrollableContent = canvas.scrollHeight > canvas.clientHeight;
    const needsScroll = hasScrollableContent && (isComponentBelowView || isComponentAboveView);

    if (needsScroll) {
      // Smart scroll: scroll to show the component, not just to bottom
      if (isComponentBelowView) {
        // Scroll down to show component
        canvas.scrollTo({
          top: canvas.scrollTop + (componentRect.bottom - canvasRect.bottom) + SCROLL_PADDING_PX, // 20px padding
          behavior: 'smooth',
        });
      } else if (isComponentAboveView) {
        // Scroll up to show component
        canvas.scrollTo({
          top: canvas.scrollTop - (canvasRect.top - componentRect.top) - SCROLL_PADDING_PX, // 20px padding
          behavior: 'smooth',
        });
      }
    }
  }, SCROLL_AFTER_INSERT_MS); // Small delay to ensure component is rendered
}
