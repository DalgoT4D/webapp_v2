'use client';

import React, { useState } from 'react';
import { useChartSuggestions } from '@/hooks/api/useChart';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lightbulb, TrendingUp, BarChart3, PieChart, LineChart } from 'lucide-react';
import type { ChartSuggestion } from '@/hooks/api/useChart';

interface ChartSuggestionsProps {
  schemaName: string;
  tableName: string;
  onSuggestionSelect: (suggestion: ChartSuggestion) => void;
}

const chartTypeIcons = {
  bar: BarChart3,
  line: LineChart,
  pie: PieChart,
  area: TrendingUp,
  scatter: TrendingUp,
  funnel: TrendingUp,
  heatmap: TrendingUp,
  radar: TrendingUp,
  number: TrendingUp,
  map: TrendingUp,
};

const getConfidenceColor = (confidence: number) => {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800';
  if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

const getConfidenceLabel = (confidence: number) => {
  if (confidence >= 0.8) return 'High';
  if (confidence >= 0.6) return 'Medium';
  return 'Low';
};

export default function ChartSuggestions({
  schemaName,
  tableName,
  onSuggestionSelect,
}: ChartSuggestionsProps) {
  const { trigger, data: suggestions, isMutating, error } = useChartSuggestions();
  const [hasRequested, setHasRequested] = useState(false);

  const handleGetSuggestions = async () => {
    if (!schemaName || !tableName) return;

    setHasRequested(true);
    try {
      await trigger({ schema_name: schemaName, table_name: tableName });
    } catch (error) {
      console.error('Failed to get chart suggestions:', error);
    }
  };

  // Show initial state with "Get Suggestions" button
  if (!hasRequested) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Lightbulb className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Get AI Chart Suggestions</h3>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Let our AI analyze your data and suggest the best chart types for your selected table.
        </p>
        <Button
          onClick={handleGetSuggestions}
          disabled={!schemaName || !tableName}
          className="px-6 py-3"
        >
          <Lightbulb className="w-4 h-4 mr-2" />
          Get Suggestions
        </Button>
      </div>
    );
  }

  // Show loading state
  if (isMutating) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h3 className="text-lg font-semibold mb-2">Analyzing Your Data</h3>
        <p className="text-gray-600">
          Our AI is examining your table structure and data patterns to suggest the best chart
          types...
        </p>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <Lightbulb className="w-8 h-8 text-red-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2 text-red-600">Failed to Get Suggestions</h3>
        <p className="text-gray-600 mb-6">
          We couldn't analyze your data. Please try again or contact support.
        </p>
        <Button onClick={handleGetSuggestions} variant="outline" className="px-6 py-3">
          Try Again
        </Button>
      </div>
    );
  }

  // Show no suggestions
  if (!suggestions || suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Lightbulb className="w-8 h-8 text-gray-600" />
        </div>
        <h3 className="text-lg font-semibold mb-2">No Suggestions Available</h3>
        <p className="text-gray-600 mb-6">
          We couldn't find suitable chart recommendations for this table. You can still create
          charts manually.
        </p>
        <Button onClick={handleGetSuggestions} variant="outline" className="px-6 py-3">
          Try Again
        </Button>
      </div>
    );
  }

  // Show suggestions
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">AI Chart Suggestions</h3>
        <p className="text-gray-600">
          Based on your data structure, here are our recommended chart types:
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {suggestions.map((suggestion, index) => {
          const IconComponent =
            chartTypeIcons[suggestion.chart_type as keyof typeof chartTypeIcons] || BarChart3;

          return (
            <Card key={index} className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <IconComponent className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg capitalize">
                        {suggestion.chart_type} Chart
                      </CardTitle>
                      <CardDescription className="mt-1">{suggestion.reasoning}</CardDescription>
                    </div>
                  </div>
                  <Badge className={getConfidenceColor(suggestion.confidence)} variant="secondary">
                    {getConfidenceLabel(suggestion.confidence)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Suggested Configuration */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">Suggested Configuration:</p>
                  <div className="space-y-1 text-sm">
                    {suggestion.suggested_config.xAxis && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">X-Axis:</span>
                        <span className="font-medium">{suggestion.suggested_config.xAxis}</span>
                      </div>
                    )}
                    {suggestion.suggested_config.yAxis && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Y-Axis:</span>
                        <span className="font-medium">{suggestion.suggested_config.yAxis}</span>
                      </div>
                    )}
                    {suggestion.suggested_config.aggregate_func && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Aggregation:</span>
                        <span className="font-medium uppercase">
                          {suggestion.suggested_config.aggregate_func}
                        </span>
                      </div>
                    )}
                    {suggestion.suggested_config.dimensions &&
                      suggestion.suggested_config.dimensions.length > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Dimensions:</span>
                          <span className="font-medium">
                            {suggestion.suggested_config.dimensions.join(', ')}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Confidence Score */}
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Confidence:</span>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${suggestion.confidence * 100}%` }}
                    />
                  </div>
                  <span className="font-medium">{Math.round(suggestion.confidence * 100)}%</span>
                </div>

                {/* Use Suggestion Button */}
                <Button className="w-full" onClick={() => onSuggestionSelect(suggestion)} size="sm">
                  Use This Suggestion
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Get New Suggestions Button */}
      <div className="text-center">
        <Button onClick={handleGetSuggestions} variant="outline" className="px-6 py-3">
          <Lightbulb className="w-4 h-4 mr-2" />
          Get New Suggestions
        </Button>
      </div>
    </div>
  );
}
