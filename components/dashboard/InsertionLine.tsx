'use client';

interface InsertionLineProps {
  /** Pixel x position of the line within the GridLayout container */
  pixelX: number;
  /** Pixel y position of the top of the line */
  pixelY: number;
  /** Pixel height of the line (typically the height of a row) */
  pixelHeight: number;
  /** Whether the line should be visible */
  visible: boolean;
}

/**
 * Vertical 2px blue bar shown during drag to indicate where the chart will land.
 * Positioned absolutely within its parent (the GridLayout container).
 * Uses var(--primary) so it picks up the Dalgo brand teal in light/dark mode.
 */
export function InsertionLine({ pixelX, pixelY, pixelHeight, visible }: InsertionLineProps) {
  if (!visible) return null;
  return (
    <div
      data-testid="fluid-flow-insertion-line"
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: pixelX - 1,
        top: pixelY,
        width: 2,
        height: pixelHeight,
        backgroundColor: 'var(--primary)',
        pointerEvents: 'none',
        zIndex: 1000,
        borderRadius: 2,
        boxShadow: '0 0 4px var(--primary)',
        transition: 'left 80ms ease-out, top 80ms ease-out',
      }}
    />
  );
}
