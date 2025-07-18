// Chart templates with sample data for demonstration
export const CHART_TEMPLATES = {
  bar: {
    title: 'Monthly Sales by Category',
    description: 'Example bar chart showing sales performance across different product categories',
    data: {
      labels: ['Electronics', 'Clothing', 'Food & Beverage', 'Books', 'Home & Garden'],
      datasets: [
        {
          label: 'Sales ($)',
          data: [45000, 38000, 52000, 28000, 35000],
          backgroundColor: '#3B82F6',
        },
      ],
    },
    echarts: {
      xAxis: {
        type: 'category',
        data: ['Electronics', 'Clothing', 'Food & Beverage', 'Books', 'Home & Garden'],
      },
      yAxis: {
        type: 'value',
        name: 'Sales ($)',
      },
      series: [
        {
          data: [45000, 38000, 52000, 28000, 35000],
          type: 'bar',
          itemStyle: {
            color: '#3B82F6',
          },
        },
      ],
    },
  },
  line: {
    title: 'Revenue Trend Analysis',
    description: 'Example line chart showing monthly revenue trends over time',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      datasets: [
        {
          label: 'Revenue ($)',
          data: [
            65000, 72000, 68000, 85000, 92000, 98000, 105000, 112000, 108000, 115000, 122000,
            130000,
          ],
          borderColor: '#10B981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.3,
        },
      ],
    },
    echarts: {
      xAxis: {
        type: 'category',
        data: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      },
      yAxis: {
        type: 'value',
        name: 'Revenue ($)',
      },
      series: [
        {
          data: [
            65000, 72000, 68000, 85000, 92000, 98000, 105000, 112000, 108000, 115000, 122000,
            130000,
          ],
          type: 'line',
          smooth: true,
          itemStyle: {
            color: '#10B981',
          },
          areaStyle: {
            color: 'rgba(16, 185, 129, 0.1)',
          },
        },
      ],
    },
  },
  pie: {
    title: 'Market Share Distribution',
    description: 'Example pie chart showing market share percentages',
    data: {
      labels: ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'],
      datasets: [
        {
          data: [35, 28, 22, 10, 5],
          backgroundColor: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'],
        },
      ],
    },
    echarts: {
      series: [
        {
          type: 'pie',
          radius: '70%',
          data: [
            { value: 35, name: 'Product A', itemStyle: { color: '#3B82F6' } },
            { value: 28, name: 'Product B', itemStyle: { color: '#10B981' } },
            { value: 22, name: 'Product C', itemStyle: { color: '#F59E0B' } },
            { value: 10, name: 'Product D', itemStyle: { color: '#EF4444' } },
            { value: 5, name: 'Product E', itemStyle: { color: '#8B5CF6' } },
          ],
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    },
  },
  scatter: {
    title: 'Price vs. Satisfaction Score',
    description:
      'Example scatter plot showing relationship between price and customer satisfaction',
    data: {
      datasets: [
        {
          label: 'Products',
          data: [
            { x: 10, y: 4.2 },
            { x: 15, y: 4.5 },
            { x: 20, y: 4.3 },
            { x: 25, y: 4.6 },
            { x: 30, y: 4.4 },
            { x: 35, y: 4.7 },
            { x: 40, y: 4.5 },
            { x: 45, y: 4.8 },
            { x: 50, y: 4.6 },
            { x: 55, y: 4.9 },
            { x: 60, y: 4.7 },
            { x: 65, y: 4.8 },
          ],
          backgroundColor: '#8B5CF6',
        },
      ],
    },
    echarts: {
      xAxis: {
        type: 'value',
        name: 'Price ($)',
      },
      yAxis: {
        type: 'value',
        name: 'Satisfaction Score',
        min: 4,
        max: 5,
      },
      series: [
        {
          type: 'scatter',
          data: [
            [10, 4.2],
            [15, 4.5],
            [20, 4.3],
            [25, 4.6],
            [30, 4.4],
            [35, 4.7],
            [40, 4.5],
            [45, 4.8],
            [50, 4.6],
            [55, 4.9],
            [60, 4.7],
            [65, 4.8],
          ],
          symbolSize: 10,
          itemStyle: {
            color: '#8B5CF6',
          },
        },
      ],
    },
  },
  area: {
    title: 'Website Traffic Over Time',
    description: 'Example area chart showing daily website visits',
    data: {
      labels: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
      datasets: [
        {
          label: 'Visitors',
          data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 5000) + 3000),
          borderColor: '#F59E0B',
          backgroundColor: 'rgba(245, 158, 11, 0.2)',
          fill: true,
        },
      ],
    },
    echarts: {
      xAxis: {
        type: 'category',
        data: Array.from({ length: 30 }, (_, i) => `Day ${i + 1}`),
      },
      yAxis: {
        type: 'value',
        name: 'Visitors',
      },
      series: [
        {
          type: 'line',
          data: Array.from({ length: 30 }, () => Math.floor(Math.random() * 5000) + 3000),
          smooth: true,
          areaStyle: {
            color: 'rgba(245, 158, 11, 0.2)',
          },
          itemStyle: {
            color: '#F59E0B',
          },
        },
      ],
    },
  },
};

// Helper function to get sample data for a chart type
export function getSampleDataForChartType(chartType: string) {
  const template = CHART_TEMPLATES[chartType as keyof typeof CHART_TEMPLATES];
  if (!template) {
    // Return generic sample data if chart type not found
    return {
      title: 'Sample Chart',
      description: 'This is sample data for demonstration purposes',
      data: {
        labels: ['A', 'B', 'C', 'D', 'E'],
        datasets: [
          {
            label: 'Values',
            data: [10, 20, 30, 40, 50],
          },
        ],
      },
      echarts: {
        xAxis: { type: 'category', data: ['A', 'B', 'C', 'D', 'E'] },
        yAxis: { type: 'value' },
        series: [{ type: chartType, data: [10, 20, 30, 40, 50] }],
      },
    };
  }
  return template;
}

// Generate random data for testing
export function generateRandomData(count: number = 10) {
  return {
    labels: Array.from({ length: count }, (_, i) => `Item ${i + 1}`),
    values: Array.from({ length: count }, () => Math.floor(Math.random() * 100) + 20),
  };
}
