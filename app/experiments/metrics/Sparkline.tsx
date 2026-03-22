'use client';

import type { RagStatus } from '../_lib/types';

interface SparklineProps {
  data: number[];
  status: RagStatus;
  width?: number;
  height?: number;
}

const RAG_COLORS = {
  on_track: '#10b981', // emerald-500
  at_risk: '#f59e0b', // amber-500
  below_target: '#ef4444', // red-500
};

export function Sparkline({ data, status, width = 100, height = 32 }: SparklineProps) {
  if (!data.length) return null;

  const color = RAG_COLORS[status];
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 4;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : 0;

  const points = data.map((v, i) => {
    const x = padding + i * stepX;
    const y = padding + chartHeight - ((v - min) / range) * chartHeight;
    return `${x},${y}`;
  });
  const polylinePoints = points.join(' ');
  const areaPoints = `${padding},${height - padding} ${polylinePoints} ${width - padding},${height - padding}`;
  const lastPoint = points[points.length - 1];
  const [lastX, lastY] = lastPoint.split(',').map(Number);

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <defs>
        <linearGradient id={`sparkline-fill-${status}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.1} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#sparkline-fill-${status})`} />
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={3} fill={color} />
    </svg>
  );
}
