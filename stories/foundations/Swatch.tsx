import React from 'react';

const SWATCH_WIDTH = 130; // px — fits ~6 per row in the docs canvas

/**
 * One color chip. Pass either a `cssVar` (resolved live from globals.css, so it
 * reacts to the light/dark toolbar) or a raw `value` hex (for the JS palettes
 * that hardcode their colors today).
 */
export function Swatch({ name, value, cssVar }: { name: string; value?: string; cssVar?: string }) {
  const background = cssVar ? `var(${cssVar})` : value;
  return (
    <div style={{ width: SWATCH_WIDTH }} data-testid={`swatch-${name}`}>
      <div
        style={{
          background,
          height: 64,
          borderRadius: 8,
          border: '1px solid var(--border)',
        }}
      />
      <div style={{ fontSize: 12, marginTop: 6, fontWeight: 600 }}>{name}</div>
      <div
        style={{
          fontSize: 11,
          color: 'var(--muted-foreground)',
          fontFamily: 'var(--font-anek-mono), monospace',
        }}
      >
        {cssVar ?? value}
      </div>
    </div>
  );
}

export function SwatchGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '16px 0' }}>{children}</div>
  );
}
