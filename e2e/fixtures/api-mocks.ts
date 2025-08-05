import { Page } from '@playwright/test';

export interface ChartData {
  id: number;
  name: string;
  type: 'bar' | 'line' | 'pie';
  config: any;
  query: string;
  created_at: string;
  updated_at: string;
}

export interface Schema {
  schema_name: string;
}

export interface Table {
  table_name: string;
  table_schema: string;
}

export interface Column {
  column_name: string;
  data_type: string;
  is_nullable: string;
}

export class ApiMocks {
  constructor(private page: Page) {}

  async mockChartsList(charts: ChartData[] = []) {
    await this.page.route('**/api/charts/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(charts),
      });
    });
  }

  async mockChart(chart: ChartData) {
    await this.page.route(`**/api/charts/${chart.id}/`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(chart),
      });
    });
  }

  async mockCreateChart() {
    await this.page.route('**/api/charts/', (route) => {
      if (route.request().method() === 'POST') {
        const postData = route.request().postDataJSON();
        route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 123,
            ...postData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });
  }

  async mockUpdateChart(chartId: number) {
    await this.page.route(`**/api/charts/${chartId}/`, (route) => {
      if (route.request().method() === 'PUT') {
        const putData = route.request().postDataJSON();
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: chartId,
            ...putData,
            updated_at: new Date().toISOString(),
          }),
        });
      } else {
        route.continue();
      }
    });
  }

  async mockDeleteChart(chartId: number) {
    await this.page.route(`**/api/charts/${chartId}/`, (route) => {
      if (route.request().method() === 'DELETE') {
        route.fulfill({
          status: 204,
        });
      } else {
        route.continue();
      }
    });
  }

  async mockChartData(responseData: any) {
    await this.page.route('**/api/charts/chart-data/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    });
  }

  async mockChartDataPreview(responseData: any) {
    await this.page.route('**/api/charts/chart-data-preview/', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseData),
      });
    });
  }

  async mockSchemas(schemas: Schema[] = []) {
    await this.page.route('**/api/warehouse/schemas', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(schemas),
      });
    });
  }

  async mockTables(schemaName: string, tables: Table[] = []) {
    await this.page.route(`**/api/warehouse/tables/${schemaName}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(tables),
      });
    });
  }

  async mockTableColumns(schemaName: string, tableName: string, columns: Column[] = []) {
    await this.page.route(`**/api/warehouse/table_columns/${schemaName}/${tableName}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(columns),
      });
    });
  }

  async mockTableData(schemaName: string, tableName: string, data: any) {
    await this.page.route(`**/api/warehouse/table_data/${schemaName}/${tableName}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    });
  }

  async mockTableCount(schemaName: string, tableName: string, count: number) {
    await this.page.route(`**/api/warehouse/table_count/${schemaName}/${tableName}`, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count }),
      });
    });
  }

  // Helper to mock a complete chart creation flow
  async mockChartCreationFlow() {
    // Mock schemas
    await this.mockSchemas([{ schema_name: 'public' }, { schema_name: 'analytics' }]);

    // Mock tables for public schema
    await this.mockTables('public', [
      { table_name: 'sales', table_schema: 'public' },
      { table_name: 'customers', table_schema: 'public' },
    ]);

    // Mock columns for sales table
    await this.mockTableColumns('public', 'sales', [
      { column_name: 'id', data_type: 'integer', is_nullable: 'NO' },
      { column_name: 'product', data_type: 'text', is_nullable: 'NO' },
      { column_name: 'amount', data_type: 'numeric', is_nullable: 'NO' },
      { column_name: 'date', data_type: 'date', is_nullable: 'NO' },
    ]);

    // Mock table count
    await this.mockTableCount('public', 'sales', 1000);

    // Mock chart data preview
    await this.mockChartDataPreview({
      data: [
        { product: 'Product A', amount: 1000, date: '2024-01-01' },
        { product: 'Product B', amount: 1500, date: '2024-01-02' },
        { product: 'Product C', amount: 2000, date: '2024-01-03' },
      ],
      total: 3,
      page: 1,
      limit: 10,
    });

    // Mock chart data
    await this.mockChartData({
      chartOptions: {
        xAxis: { type: 'category', data: ['Product A', 'Product B', 'Product C'] },
        yAxis: { type: 'value' },
        series: [
          {
            data: [1000, 1500, 2000],
            type: 'bar',
          },
        ],
      },
      data: [
        { product: 'Product A', amount: 1000 },
        { product: 'Product B', amount: 1500 },
        { product: 'Product C', amount: 2000 },
      ],
    });

    // Mock create chart
    await this.mockCreateChart();
  }
}
