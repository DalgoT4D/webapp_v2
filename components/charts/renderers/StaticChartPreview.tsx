'use client';

import React from 'react';
import { BarChart3, LineChart, PieChart, Table, Map, Activity, TrendingUp } from 'lucide-react';
import { CHART_TYPE_COLORS, type ChartType } from '@/constants/chart-types';

interface StaticChartPreviewProps {
  chartType: string;
  className?: string;
}

export function StaticChartPreview({
  chartType,
  className = 'w-full h-full',
}: StaticChartPreviewProps) {
  const getChartPreview = () => {
    const chartTypeKey = chartType?.toLowerCase() as ChartType;
    const typeColors = CHART_TYPE_COLORS[chartTypeKey] || CHART_TYPE_COLORS.bar;

    switch (chartType?.toLowerCase()) {
      case 'bar':
        return (
          <div
            className={`${className} flex items-end justify-center gap-2 p-4 rounded-lg`}
            style={{ backgroundColor: typeColors.bgColor }}
          >
            <div className="w-6 h-12 rounded-sm" style={{ backgroundColor: typeColors.color }} />
            <div
              className="w-6 h-16 rounded-sm"
              style={{ backgroundColor: `${typeColors.color}CC` }}
            />
            <div className="w-6 h-8 rounded-sm" style={{ backgroundColor: typeColors.color }} />
            <div
              className="w-6 h-20 rounded-sm"
              style={{ backgroundColor: `${typeColors.color}DD` }}
            />
            <div
              className="w-6 h-14 rounded-sm"
              style={{ backgroundColor: `${typeColors.color}CC` }}
            />
          </div>
        );

      case 'line':
        const lineColors = CHART_TYPE_COLORS.line;
        return (
          <div
            className={`${className} flex items-center justify-center p-4 rounded-lg relative`}
            style={{ backgroundColor: lineColors.bgColor }}
          >
            <svg viewBox="0 0 100 60" className="w-full h-full">
              <polyline
                points="10,45 25,35 40,20 55,25 70,15 85,10"
                fill="none"
                stroke={lineColors.color}
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              <circle cx="10" cy="45" r="2" fill={lineColors.color} />
              <circle cx="25" cy="35" r="2" fill={lineColors.color} />
              <circle cx="40" cy="20" r="2" fill={lineColors.color} />
              <circle cx="55" cy="25" r="2" fill={lineColors.color} />
              <circle cx="70" cy="15" r="2" fill={lineColors.color} />
              <circle cx="85" cy="10" r="2" fill={lineColors.color} />
            </svg>
          </div>
        );

      case 'pie':
        const pieColors = CHART_TYPE_COLORS.pie;
        return (
          <div
            className={`${className} flex items-center justify-center p-4 rounded-lg`}
            style={{ backgroundColor: pieColors.bgColor }}
          >
            <svg viewBox="0 0 100 100" className="w-16 h-16">
              <circle cx="50" cy="50" r="35" fill={pieColors.color} />
              <path d="M 50,50 L 50,15 A 35,35 0 0,1 71.21,28.79 Z" fill={`${pieColors.color}CC`} />
              <path d="M 50,50 L 71.21,28.79 A 35,35 0 0,1 85,50 Z" fill={`${pieColors.color}AA`} />
              <path d="M 50,50 L 85,50 A 35,35 0 0,1 71.21,71.21 Z" fill={`${pieColors.color}88`} />
            </svg>
          </div>
        );

      case 'table':
        const tableColors = CHART_TYPE_COLORS.table;
        return (
          <div
            className={`${className} flex items-center justify-center p-4 rounded-lg`}
            style={{ backgroundColor: tableColors.bgColor }}
          >
            <div className="w-full h-full max-w-24 max-h-20 border border-slate-300 bg-white rounded-sm overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-3 bg-slate-200 border-b border-slate-300">
                <div className="p-1 text-[6px] font-semibold text-slate-700 border-r border-slate-300 flex items-center justify-center">
                  ID
                </div>
                <div className="p-1 text-[6px] font-semibold text-slate-700 border-r border-slate-300 flex items-center justify-center">
                  Name
                </div>
                <div className="p-1 text-[6px] font-semibold text-slate-700 flex items-center justify-center">
                  Value
                </div>
              </div>
              {/* Table Rows */}
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  001
                </div>
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  Item A
                </div>
                <div className="p-1 text-[5px] text-slate-600 flex items-center justify-center">
                  $25
                </div>
              </div>
              <div className="grid grid-cols-3 border-b border-slate-200">
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  002
                </div>
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  Item B
                </div>
                <div className="p-1 text-[5px] text-slate-600 flex items-center justify-center">
                  $40
                </div>
              </div>
              <div className="grid grid-cols-3">
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  003
                </div>
                <div className="p-1 text-[5px] text-slate-600 border-r border-slate-200 flex items-center justify-center">
                  Item C
                </div>
                <div className="p-1 text-[5px] text-slate-600 flex items-center justify-center">
                  $35
                </div>
              </div>
            </div>
          </div>
        );

      case 'map':
        const mapColors = CHART_TYPE_COLORS.map;
        return (
          <div
            className={`${className} flex items-center justify-center p-4 rounded-lg`}
            style={{ backgroundColor: mapColors.bgColor }}
          >
            <div className="w-full h-full max-w-16 max-h-20 flex items-center justify-center">
              <img
                src="/chart_icons/world_map.svg"
                alt="World Map"
                className="w-full h-full object-contain"
                style={{
                  filter:
                    'invert(14%) sepia(89%) saturate(1258%) hue-rotate(152deg) brightness(95%) contrast(95%)',
                  opacity: 0.9,
                }}
              />
            </div>
          </div>
        );

      case 'gauge':
      case 'number':
      case 'metric':
      case 'kpi':
        const numberColors = CHART_TYPE_COLORS.number;
        return (
          <div
            className={`${className} flex items-center justify-center p-4 rounded-lg`}
            style={{ backgroundColor: numberColors.bgColor }}
          >
            <div
              className="bg-white border-2 rounded-lg p-3 shadow-sm w-20 h-16 flex flex-col items-center justify-center"
              style={{ borderColor: numberColors.color + '40' }}
            >
              {/* Large Number */}
              <div className="text-xl font-bold" style={{ color: numberColors.color }}>
                847
              </div>
              {/* Label */}
              <div
                className="text-[8px] font-medium mt-1"
                style={{ color: numberColors.color + 'CC' }}
              >
                TOTAL
              </div>
            </div>
          </div>
        );

      case 'echarts':
      case 'recharts':
      case 'nivo':
        return (
          <div
            className={`${className} flex items-end justify-center gap-1 p-4 bg-gradient-to-b from-orange-50 to-orange-100 rounded-lg`}
          >
            <div className="w-4 h-8 bg-orange-500 rounded-sm" />
            <div className="w-4 h-12 bg-orange-400 rounded-sm" />
            <div className="w-4 h-6 bg-orange-600 rounded-sm" />
            <div className="w-4 h-16 bg-orange-500 rounded-sm" />
            <div className="w-4 h-10 bg-orange-400 rounded-sm" />
            <div className="w-4 h-14 bg-orange-500 rounded-sm" />
          </div>
        );

      default:
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg`}
          >
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
        );
    }
  };

  return getChartPreview();
}
