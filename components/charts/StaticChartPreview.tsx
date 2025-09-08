'use client';

import React from 'react';
import { BarChart3, LineChart, PieChart, Table, Map, Activity, TrendingUp } from 'lucide-react';

interface StaticChartPreviewProps {
  chartType: string;
  className?: string;
}

export function StaticChartPreview({
  chartType,
  className = 'w-full h-full',
}: StaticChartPreviewProps) {
  const getChartPreview = () => {
    switch (chartType?.toLowerCase()) {
      case 'bar':
        return (
          <div
            className={`${className} flex items-end justify-center gap-2 p-4 bg-gradient-to-b from-blue-50 to-blue-100 rounded-lg`}
          >
            <div className="w-6 h-12 bg-blue-500 rounded-sm" />
            <div className="w-6 h-16 bg-blue-400 rounded-sm" />
            <div className="w-6 h-8 bg-blue-600 rounded-sm" />
            <div className="w-6 h-20 bg-blue-500 rounded-sm" />
            <div className="w-6 h-14 bg-blue-400 rounded-sm" />
          </div>
        );

      case 'line':
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg relative`}
          >
            <svg viewBox="0 0 100 60" className="w-full h-full">
              <polyline
                points="10,45 25,35 40,20 55,25 70,15 85,10"
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                className="drop-shadow-sm"
              />
              <circle cx="10" cy="45" r="2" fill="#059669" />
              <circle cx="25" cy="35" r="2" fill="#059669" />
              <circle cx="40" cy="20" r="2" fill="#059669" />
              <circle cx="55" cy="25" r="2" fill="#059669" />
              <circle cx="70" cy="15" r="2" fill="#059669" />
              <circle cx="85" cy="10" r="2" fill="#059669" />
            </svg>
          </div>
        );

      case 'pie':
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg`}
          >
            <svg viewBox="0 0 100 100" className="w-16 h-16">
              <circle cx="50" cy="50" r="35" fill="#8b5cf6" />
              <path d="M 50,50 L 50,15 A 35,35 0 0,1 71.21,28.79 Z" fill="#a78bfa" />
              <path d="M 50,50 L 71.21,28.79 A 35,35 0 0,1 85,50 Z" fill="#c4b5fd" />
              <path d="M 50,50 L 85,50 A 35,35 0 0,1 71.21,71.21 Z" fill="#ddd6fe" />
            </svg>
          </div>
        );

      case 'table':
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-slate-100 rounded-lg`}
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
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg`}
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
        return (
          <div
            className={`${className} flex items-center justify-center p-4 bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg`}
          >
            <div className="bg-white border-2 border-indigo-200 rounded-lg p-3 shadow-sm w-20 h-16 flex flex-col items-center justify-center">
              {/* Large Number */}
              <div className="text-xl font-bold text-indigo-700">847</div>
              {/* Label */}
              <div className="text-[8px] text-indigo-500 font-medium mt-1">TOTAL</div>
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
