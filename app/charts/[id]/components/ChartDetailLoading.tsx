'use client';

export function ChartDetailLoading() {
  return (
    <div className="container mx-auto p-6">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
        <div className="h-96 bg-gray-200 rounded"></div>
      </div>
    </div>
  );
}
