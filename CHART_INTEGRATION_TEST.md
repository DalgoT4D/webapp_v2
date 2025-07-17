# Chart API Integration Testing Guide

This guide helps you test the complete chart creation workflow from frontend to backend.

## Prerequisites

### 1. Backend Setup
```bash
cd /Users/siddhant/Documents/Dalgo/DDP_backend

# Install dependencies (if not already done)
pip install -r requirements.txt

# Apply database migrations
python manage.py migrate

# Load seed data (includes chart permissions)
python manage.py loaddata seed/*.json

# Start the backend server
python manage.py runserver
```

### 2. Frontend Setup
```bash
cd /Users/siddhant/Documents/Dalgo/webapp_v2

# Install dependencies
npm install

# Start the frontend development server
npm run dev
```

## Testing Steps

### Step 1: Manual Backend API Testing

Use the integration test script:
```bash
# Update AUTH_TOKEN and ORG_SLUG in test-integration.js
node test-integration.js
```

### Step 2: Frontend Integration Testing

1. **Open Frontend**: Navigate to `http://localhost:3001`

2. **Login**: Use valid credentials to get authentication token

3. **Navigate to Charts**: Go to `/charts` page

4. **Test Chart Creation**:
   - Select a schema from dropdown
   - Select a table from dropdown
   - Choose X and Y axes
   - Select chart type (bar, line, pie, etc.)
   - Preview should show live chart
   - Fill in chart name and description
   - Click "Save Chart"

5. **Test Chart Management**:
   - View created charts in the list
   - Edit existing charts
   - Delete charts
   - Toggle favorites

### Step 3: Backend API Endpoints

The frontend uses these endpoints:

#### Chart Data Generation
```
POST /api/visualization/charts/generate
```

#### Chart CRUD Operations
```
GET    /api/visualization/charts/          # List charts
POST   /api/visualization/charts/          # Create chart
GET    /api/visualization/charts/{id}      # Get chart
PUT    /api/visualization/charts/{id}      # Update chart
DELETE /api/visualization/charts/{id}      # Delete chart
```

#### Data Source Endpoints
```
GET /api/warehouse/schemas                          # Get schemas
GET /api/warehouse/tables/{schema}                  # Get tables
GET /api/warehouse/table_columns/{schema}/{table}  # Get columns
```

### Step 4: Error Testing

Test these error scenarios:

1. **Authentication Errors**:
   - Invalid or missing JWT token
   - Invalid organization slug

2. **Data Errors**:
   - Non-existent schema/table
   - Invalid column names
   - Missing required fields

3. **Permission Errors**:
   - User without chart permissions
   - Accessing charts from other organizations

## Common Issues & Solutions

### Issue: 401 Unauthorized
**Solution**: Check authentication token in browser localStorage:
```javascript
console.log(localStorage.getItem('authToken'));
console.log(localStorage.getItem('selectedOrg'));
```

### Issue: 500 Internal Server Error
**Solution**: Check backend logs for detailed errors:
```bash
# Check Django logs
python manage.py runserver --verbosity=2
```

### Issue: Chart data not loading
**Solution**: Verify database has data:
```sql
-- Check if tables exist
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Check table data
SELECT * FROM your_table_name LIMIT 5;
```

### Issue: CORS errors
**Solution**: Ensure backend CORS settings allow frontend domain:
```python
# In Django settings
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
]
```

## Expected Behavior

### Successful Chart Creation Flow:
1. User selects schema → Tables load
2. User selects table → Columns load
3. User configures chart → Preview generates
4. User saves chart → Chart appears in list

### API Response Format:
```json
{
  "success": true,
  "data": {
    "chart_config": {
      "xAxis": { "data": [...] },
      "yAxis": { "type": "value" },
      "series": [{ "type": "bar", "data": [...] }]
    }
  },
  "message": "Chart data generated successfully"
}
```

## Database Schema

The chart functionality uses these tables:
- `charts` - Chart metadata and configuration
- `chart_snapshots` - Cached chart data for performance

## Performance Considerations

1. **Caching**: Chart data is cached for 1 hour
2. **Limits**: Default limit is 100 records for chart data
3. **Pagination**: Chart lists support pagination

## Security Notes

1. **Permissions**: Users need appropriate chart permissions
2. **Organization Isolation**: Charts are isolated by organization
3. **Data Access**: Only accessible warehouse data is shown

## Debugging Tips

1. **Network Tab**: Check browser network tab for API calls
2. **Console Logs**: Look for JavaScript errors in browser console
3. **Backend Logs**: Check Django server output for errors
4. **Database Queries**: Use Django Debug Toolbar to see SQL queries

## Next Steps

Once integration is working:
1. Add more chart types (scatter, heatmap, etc.)
2. Implement dashboard integration
3. Add export functionality
4. Add real-time data updates
5. Implement chart sharing features