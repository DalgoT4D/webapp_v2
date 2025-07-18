import { describe, it, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8002';
let authToken: string;
let testChartId: number;

// Helper function to make authenticated requests
async function apiRequest(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${authToken}`,
      'x-dalgo-org': 'admin-org',
      ...options.headers,
    },
  });
}

describe('Chart API Tests', () => {
  // Setup - Login and get auth token
  beforeAll(async () => {
    const loginResponse = await fetch(`${API_BASE_URL}/api/login/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'test@dalgo.com',
        password: 'testpass123',
      }),
    });

    const loginData = await loginResponse.json();
    authToken = loginData.token;
  });

  // Cleanup - Delete test charts
  afterAll(async () => {
    if (testChartId) {
      await apiRequest(`/api/charts/${testChartId}`, { method: 'DELETE' });
    }
  });

  describe('POST /api/charts/generate', () => {
    it('should generate aggregated chart data', async () => {
      const response = await apiRequest('/api/charts/generate', {
        method: 'POST',
        body: JSON.stringify({
          chart_type: 'bar',
          computation_type: 'aggregated',
          schema_name: 'analytics',
          table_name: 'sales',
          xaxis: 'product_category',
          aggregate_col: 'total_amount',
          aggregate_func: 'sum',
          aggregate_col_alias: 'total_sales',
          limit: 10,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('chart_config');
      expect(data.data).toHaveProperty('raw_data');
      expect(data.data.raw_data).toHaveProperty('data');
      expect(Array.isArray(data.data.raw_data.data)).toBe(true);
    });

    it('should generate raw chart data', async () => {
      const response = await apiRequest('/api/charts/generate', {
        method: 'POST',
        body: JSON.stringify({
          chart_type: 'line',
          computation_type: 'raw',
          schema_name: 'analytics',
          table_name: 'sales',
          xaxis: 'date',
          yaxis: 'total_amount',
          limit: 20,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('chart_config');
    });

    it('should fail with invalid schema', async () => {
      const response = await apiRequest('/api/charts/generate', {
        method: 'POST',
        body: JSON.stringify({
          chart_type: 'bar',
          computation_type: 'aggregated',
          schema_name: 'invalid_schema',
          table_name: 'sales',
          xaxis: 'product_category',
          aggregate_col: 'total_amount',
          aggregate_func: 'sum',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.success).toBe(false);
    });

    it('should fail with missing required fields', async () => {
      const response = await apiRequest('/api/charts/generate', {
        method: 'POST',
        body: JSON.stringify({
          chart_type: 'bar',
          computation_type: 'aggregated',
          // Missing schema_name and table_name
        }),
      });

      expect(response.status).toBe(422);
    });

    it('should handle different aggregation functions', async () => {
      const aggregateFunctions = ['sum', 'avg', 'count', 'min', 'max'];

      for (const func of aggregateFunctions) {
        const response = await apiRequest('/api/charts/generate', {
          method: 'POST',
          body: JSON.stringify({
            chart_type: 'bar',
            computation_type: 'aggregated',
            schema_name: 'analytics',
            table_name: 'sales',
            xaxis: 'region',
            aggregate_col: func === 'count' ? null : 'quantity',
            aggregate_func: func,
            aggregate_col_alias: `${func}_result`,
          }),
        });

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.success).toBe(true);
      }
    });
  });

  describe('POST /api/charts/', () => {
    it('should create a new chart', async () => {
      const response = await apiRequest('/api/charts/', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Test Chart',
          description: 'Test chart description',
          chart_type: 'echarts',
          schema_name: 'analytics',
          table: 'sales',
          config: {
            chartType: 'bar',
            computation_type: 'aggregated',
            xaxis: 'product_category',
            aggregate_col: 'total_amount',
            aggregate_func: 'sum',
            aggregate_col_alias: 'total_sales',
          },
          is_public: false,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('id');
      expect(data.data.title).toBe('Test Chart');

      testChartId = data.data.id;
    });

    it('should fail without title', async () => {
      const response = await apiRequest('/api/charts/', {
        method: 'POST',
        body: JSON.stringify({
          description: 'No title chart',
          chart_type: 'echarts',
          schema_name: 'analytics',
          table: 'sales',
          config: {},
        }),
      });

      expect(response.status).toBe(422);
    });
  });

  describe('GET /api/charts/{chart_id}', () => {
    it('should retrieve an existing chart', async () => {
      const response = await apiRequest(`/api/charts/${testChartId}`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testChartId);
      expect(data.data.title).toBe('Test Chart');
    });

    it('should return 404 for non-existent chart', async () => {
      const response = await apiRequest('/api/charts/999999');

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.success).toBe(false);
    });
  });

  describe('PUT /api/charts/{chart_id}', () => {
    it('should update an existing chart', async () => {
      const response = await apiRequest(`/api/charts/${testChartId}`, {
        method: 'PUT',
        body: JSON.stringify({
          title: 'Updated Test Chart',
          description: 'Updated description',
          is_public: true,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.title).toBe('Updated Test Chart');
      expect(data.data.is_public).toBe(true);
    });
  });

  describe('GET /api/charts/', () => {
    it('should list all charts', async () => {
      const response = await apiRequest('/api/charts/');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);

      // Handle both paginated and non-paginated responses
      const charts = data.data.items || data.data;
      expect(Array.isArray(charts)).toBe(true);

      // Should contain our test chart
      const testChart = charts.find((c: any) => c.id === testChartId);
      expect(testChart).toBeTruthy();
    });

    it('should support pagination', async () => {
      const response = await apiRequest('/api/charts/?limit=5&offset=0');

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Warehouse Endpoints', () => {
    describe('GET /api/warehouse/schemas/', () => {
      it('should return available schemas', async () => {
        const response = await apiRequest('/api/warehouse/schemas/');

        expect(response.status).toBe(200);
        const schemas = await response.json();
        expect(Array.isArray(schemas)).toBe(true);
        expect(schemas).toContain('analytics');
        expect(schemas).toContain('public');
      });
    });

    describe('GET /api/warehouse/tables/', () => {
      it('should return tables for a schema', async () => {
        const response = await apiRequest('/api/warehouse/tables/?schema_name=analytics');

        expect(response.status).toBe(200);
        const tables = await response.json();
        expect(Array.isArray(tables)).toBe(true);
        expect(tables).toContain('sales');
        expect(tables).toContain('customers');
      });

      it('should fail without schema_name', async () => {
        const response = await apiRequest('/api/warehouse/tables/');
        expect(response.status).toBe(422);
      });
    });

    describe('GET /api/warehouse/columns/', () => {
      it('should return columns with data types', async () => {
        const response = await apiRequest(
          '/api/warehouse/columns/?schema_name=analytics&table_name=sales'
        );

        expect(response.status).toBe(200);
        const columns = await response.json();
        expect(Array.isArray(columns)).toBe(true);
        expect(columns.length).toBeGreaterThan(0);

        // Check column structure
        const idColumn = columns.find((c: any) => c.name === 'id');
        expect(idColumn).toBeTruthy();
        expect(idColumn).toHaveProperty('data_type');
      });

      it('should fail without required parameters', async () => {
        const response = await apiRequest('/api/warehouse/columns/?schema_name=analytics');
        expect(response.status).toBe(422);
      });
    });
  });

  describe('DELETE /api/charts/{chart_id}', () => {
    it('should delete an existing chart', async () => {
      // Create a chart to delete
      const createResponse = await apiRequest('/api/charts/', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Chart to Delete',
          chart_type: 'echarts',
          schema_name: 'analytics',
          table: 'sales',
          config: {},
        }),
      });

      const createData = await createResponse.json();
      const chartIdToDelete = createData.data.id;

      // Delete the chart
      const deleteResponse = await apiRequest(`/api/charts/${chartIdToDelete}`, {
        method: 'DELETE',
      });

      expect(deleteResponse.status).toBe(200);
      const deleteData = await deleteResponse.json();
      expect(deleteData.success).toBe(true);

      // Verify it's deleted
      const getResponse = await apiRequest(`/api/charts/${chartIdToDelete}`);
      expect(getResponse.status).toBe(404);
    });

    it('should return 404 when deleting non-existent chart', async () => {
      const response = await apiRequest('/api/charts/999999', {
        method: 'DELETE',
      });

      expect(response.status).toBe(404);
    });
  });
});
