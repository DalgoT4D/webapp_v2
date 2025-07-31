/**
 * Integration test script to verify chart API connectivity
 * Run this with: node test-integration.js
 */

const BASE_URL = 'http://localhost:8002';

// Mock authentication - replace with actual token
const AUTH_TOKEN = 'your-jwt-token-here';
const ORG_SLUG = 'your-org-slug';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${AUTH_TOKEN}`,
  'x-dalgo-org': ORG_SLUG,
};

async function testEndpoint(url, method = 'GET', body = null) {
  try {
    const options = {
      method,
      headers,
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    console.log(`\n🔍 Testing ${method} ${url}`);
    const response = await fetch(`${BASE_URL}${url}`, options);
    const data = await response.json();

    if (response.ok) {
      console.log('✅ Success:', data);
    } else {
      console.log('❌ Error:', data);
    }

    return { success: response.ok, data };
  } catch (error) {
    console.log('❌ Network Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runIntegrationTests() {
  console.log('🚀 Starting Chart API Integration Tests\n');

  // Test 1: Get schemas
  await testEndpoint('/api/warehouse/schemas');

  // Test 2: Get tables (assuming 'public' schema exists)
  await testEndpoint('/api/warehouse/tables/public');

  // Test 3: Get columns (assuming 'public.users' table exists)
  await testEndpoint('/api/warehouse/table_columns/public/users');

  // Test 4: Generate chart data (raw)
  await testEndpoint('/api/visualization/charts/generate', 'POST', {
    chart_type: 'bar',
    computation_type: 'raw',
    schema_name: 'public',
    table_name: 'users',
    xaxis: 'id',
    yaxis: 'created_at',
    offset: 0,
    limit: 5,
  });

  // Test 5: Generate chart data (aggregated)
  await testEndpoint('/api/visualization/charts/generate', 'POST', {
    chart_type: 'bar',
    computation_type: 'aggregated',
    schema_name: 'public',
    table_name: 'users',
    xaxis: 'status',
    aggregate_func: 'count',
    aggregate_col: '*',
    aggregate_col_alias: 'user_count',
    offset: 0,
    limit: 10,
  });

  // Test 6: Create a chart
  const createResult = await testEndpoint('/api/visualization/charts/', 'POST', {
    title: 'Test Chart',
    description: 'Integration test chart',
    chart_type: 'echarts',
    schema_name: 'public',
    table: 'users',
    config: {
      chartType: 'bar',
      computation_type: 'raw',
      xAxis: 'id',
      yAxis: 'created_at',
    },
    is_public: false,
  });

  // Test 7: Get all charts
  await testEndpoint('/api/visualization/charts/');

  // Test 8: Get single chart (if creation was successful)
  if (createResult.success && createResult.data.data?.id) {
    const chartId = createResult.data.data.id;
    await testEndpoint(`/api/visualization/charts/${chartId}`);

    // Test 9: Update chart
    await testEndpoint(`/api/visualization/charts/${chartId}`, 'PUT', {
      title: 'Updated Test Chart',
      description: 'Updated description',
    });

    // Test 10: Toggle favorite
    await testEndpoint(`/api/visualization/charts/${chartId}/favorite`, 'POST');

    // Test 11: Delete chart
    await testEndpoint(`/api/visualization/charts/${chartId}`, 'DELETE');
  }

  console.log('\n🏁 Integration tests completed!');
  console.log('\nNote: Update AUTH_TOKEN and ORG_SLUG in this script for actual testing');
}

// Run the tests
runIntegrationTests().catch(console.error);
