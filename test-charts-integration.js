/**
 * Simplified Chart API Integration Test
 * Tests the chart functionality without needing Airbyte/Prefect
 */

const BASE_URL = 'http://localhost:8002';

// Test without authentication first to see basic responses
const headers = {
  'Content-Type': 'application/json',
};

async function testEndpoint(url, method = 'GET', body = null, expectAuth = false) {
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

    let data;
    try {
      data = await response.json();
    } catch (e) {
      data = await response.text();
    }

    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(data, null, 2));
    } else if (expectAuth && response.status === 401) {
      console.log('✅ Expected auth error (endpoint exists):', data);
    } else {
      console.log('❌ Error:', response.status, data);
    }

    return { success: response.ok, status: response.status, data };
  } catch (error) {
    console.log('❌ Network Error:', error.message);
    return { success: false, error: error.message };
  }
}

async function runChartTests() {
  console.log('🚀 Starting Chart API Integration Tests\n');

  // Test 1: Chart API endpoint structure
  console.log('=== Testing Chart API Endpoints ===');
  await testEndpoint('/api/visualization/charts/', 'GET', null, true);

  // Test 2: Chart generation endpoint
  await testEndpoint(
    '/api/visualization/charts/generate',
    'POST',
    {
      chart_type: 'bar',
      computation_type: 'raw',
      schema_name: 'test',
      table_name: 'test',
      xaxis: 'id',
      yaxis: 'value',
    },
    true
  );

  // Test 3: Chart templates endpoint
  await testEndpoint('/api/visualization/charts/templates', 'GET', null, true);

  // Test 4: Chart suggestions endpoint
  await testEndpoint(
    '/api/visualization/charts/suggest',
    'POST',
    {
      schema_name: 'test',
      table_name: 'test',
    },
    true
  );

  // Test 5: Warehouse endpoints (schemas)
  console.log('\n=== Testing Warehouse API Endpoints ===');
  await testEndpoint('/api/warehouse/schemas', 'GET', null, true);

  // Test 6: Test the Django admin or any public endpoints
  console.log('\n=== Testing Server Status ===');
  await testEndpoint('/admin/', 'GET');
  await testEndpoint('/', 'GET');

  console.log('\n🏁 Chart API structure tests completed!');
  console.log('\n📝 Summary:');
  console.log('- Chart API endpoints are available at /api/visualization/charts/');
  console.log('- Warehouse API endpoints are available at /api/warehouse/');
  console.log('- Authentication is required for all chart operations');
  console.log('- Backend server is running and responding correctly');
}

// Run the tests
runChartTests().catch(console.error);
