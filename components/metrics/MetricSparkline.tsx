'use client';

import type { TrendPoint } from '@/types/metrics';

interface MetricSparklineProps {
  data: TrendPoint[];
  width?: number;
  height?: number;
  className?: string;
}

export function MetricSparkline({
  data,
  width = 280,
  height = 40,
  className,
}: MetricSparklineProps) {
  // Filter out null values for the line
  const points = data.filter((d) => d.value != null) as Array<{
    period: string;
    value: number;
  }>;

  if (points.length < 2) {
    return (
      <div className={className} style={{ height }}>
        <span className="text-xs text-muted-foreground italic">Insufficient data</span>
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const padding = 3;
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  // Build SVG path
  const pathPoints = points.map((p, i) => {
    const x = padding + (i / (points.length - 1)) * innerWidth;
    const y = padding + innerHeight - ((p.value - minVal) / range) * innerHeight;
    return { x, y };
  });

  const linePath = 'M ' + pathPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ');

  // Fill area path
  const fillPath =
    linePath +
    ` L ${pathPoints[pathPoints.length - 1].x.toFixed(1)},${(height - padding).toFixed(1)}` +
    ` L ${pathPoints[0].x.toFixed(1)},${(height - padding).toFixed(1)} Z`;

  // Determine trend direction for colour
  const firstVal = values[0];
  const lastVal = values[values.length - 1];
  const isUp = lastVal >= firstVal;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: '100%', height }}
      aria-label={`Trend: ${isUp ? 'up' : 'down'} from ${firstVal} to ${lastVal}`}
    >
      {/* Fill */}
      <path d={fillPath} fill={isUp ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.10)'} />
      {/* Line */}
      <path
        d={linePath}
        fill="none"
        stroke={isUp ? '#10b981' : '#ef4444'}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* End dot */}
      <circle
        cx={pathPoints[pathPoints.length - 1].x}
        cy={pathPoints[pathPoints.length - 1].y}
        r={2.5}
        fill={isUp ? '#10b981' : '#ef4444'}
      />
    </svg>
  );
}
