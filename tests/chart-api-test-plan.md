# Chart API Comprehensive Test Plan

## Overview
This document outlines all chart-related APIs, their test cases, and implementation details.

## API Endpoints

### 1. Generate Chart Data
**Endpoint**: `POST /api/charts/generate`
**Purpose**: Generate chart data for preview before saving

#### Test Cases:
- ✅ Test raw data generation (line/bar charts with x/y axes)
- ✅ Test aggregated data generation (with grouping and aggregation)
- ✅ Test with different aggregation functions (sum, avg, count, min, max)
- ✅ Test with invalid schema/table names
- ✅ Test with SQL injection attempts
- ✅ Test rate limiting
- ✅ Test missing required fields
- ✅ Test with non-existent columns

### 2. Create Chart
**Endpoint**: `POST /api/charts/`
**Purpose**: Save a new chart configuration

#### Test Cases:
- ✅ Test creating chart with valid data
- ✅ Test creating chart without title
- ✅ Test creating chart with invalid config
- ✅ Test creating public vs private charts
- ✅ Test rate limiting
- ✅ Test with different chart types (bar, line, pie)

### 3. Get Chart
**Endpoint**: `GET /api/charts/{chart_id}`
**Purpose**: Retrieve a specific chart

#### Test Cases:
- ✅ Test retrieving existing chart
- ✅ Test retrieving non-existent chart
- ✅ Test retrieving chart from another organization
- ✅ Test retrieving public chart as different user

### 4. Update Chart
**Endpoint**: `PUT /api/charts/{chart_id}`
**Purpose**: Update existing chart configuration

#### Test Cases:
- ✅ Test updating chart title and description
- ✅ Test updating chart configuration
- ✅ Test updating chart visibility (public/private)
- ✅ Test updating non-existent chart
- ✅ Test updating chart from another organization

### 5. Delete Chart
**Endpoint**: `DELETE /api/charts/{chart_id}`
**Purpose**: Delete a chart

#### Test Cases:
- ✅ Test deleting existing chart
- ✅ Test deleting non-existent chart
- ✅ Test deleting chart from another organization
- ✅ Test cascade deletion of related data

### 6. List Charts
**Endpoint**: `GET /api/charts/`
**Purpose**: List all charts for the organization

#### Test Cases:
- ✅ Test listing charts with pagination
- ✅ Test filtering by chart type
- ✅ Test searching by title
- ✅ Test sorting by created date
- ✅ Test empty results

### 7. Get Chart Schemas
**Endpoint**: `GET /api/warehouse/schemas/`
**Purpose**: Get available schemas for chart builder

#### Test Cases:
- ✅ Test retrieving schemas with valid warehouse
- ✅ Test retrieving schemas without warehouse setup
- ✅ Test with connection errors

### 8. Get Chart Tables
**Endpoint**: `GET /api/warehouse/tables/?schema_name={schema}`
**Purpose**: Get tables for a specific schema

#### Test Cases:
- ✅ Test retrieving tables for valid schema
- ✅ Test retrieving tables for non-existent schema
- ✅ Test with missing schema parameter

### 9. Get Chart Columns
**Endpoint**: `GET /api/warehouse/columns/?schema_name={schema}&table_name={table}`
**Purpose**: Get columns with data types for a table

#### Test Cases:
- ✅ Test retrieving columns for valid table
- ✅ Test retrieving columns for non-existent table
- ✅ Test with missing parameters
- ✅ Test column data type mapping

## Frontend Component Tests

### ChartBuilder Component
- ✅ Test chart type selection
- ✅ Test computation type toggle
- ✅ Test schema/table selection cascade
- ✅ Test column selection for raw vs aggregated
- ✅ Test form validation
- ✅ Test preview generation
- ✅ Test save functionality
- ✅ Test cancel functionality

### ChartPreview Component
- ✅ Test chart rendering with different types
- ✅ Test loading states
- ✅ Test error states
- ✅ Test empty data handling
- ✅ Test export functionality
- ✅ Test responsive behavior

### ChartList Component
- ✅ Test chart card rendering
- ✅ Test pagination
- ✅ Test search functionality
- ✅ Test delete confirmation
- ✅ Test navigation to builder
- ✅ Test chart preview modal

## Integration Tests

### End-to-End Chart Creation Flow
1. Navigate to charts page
2. Click create chart
3. Select chart type and computation
4. Select schema and table
5. Configure columns/aggregations
6. Preview chart
7. Save chart
8. Verify in list
9. Export chart as PNG

### Data Flow Tests
1. Test data fetching with SWR hooks
2. Test error handling and retries
3. Test cache invalidation after CRUD operations
4. Test optimistic updates

## Performance Tests
- ✅ Test large dataset handling (>10k rows)
- ✅ Test concurrent chart generation
- ✅ Test memory usage during export
- ✅ Test query optimization