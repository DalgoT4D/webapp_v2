# Chart UI Testing Guide

## Overview
This guide helps test the new chart creation UI improvements.

## Testing Steps

### 1. Chart Creation Flow
1. Navigate to http://localhost:3001/charts/new
2. Select a chart type (Bar, Pie, Line, Number)
3. In the Data Configuration step, observe:
   - Title and Description are now in the Basic Configuration tab
   - Data Type selection uses a new segmented control (not radio buttons)
   - Aggregated is selected by default for Bar, Pie, and Line charts
   - Customization options are in a separate tab

### 2. Map Chart Testing
1. Select the Map chart type
2. Should see "Map Charts Coming Soon" message
3. Click "Choose Another Chart Type" to go back

### 3. Default Values Testing
- Bar Chart: Check orientation is 'vertical', data labels off, not stacked
- Pie Chart: Check chart style is 'pie', label format is 'percentage'
- Line Chart: Check line style is 'straight', data points shown
- Number Chart: Check it's always aggregated (no data type selector)

### 4. UI Improvements
- No more 4-step wizard, now just 2 main steps (Chart Type, Configure Chart)
- Cleaner data type selector using segmented control
- Better organization with tabs for Basic vs Customization

## Expected Behavior
1. Faster chart creation with sensible defaults
2. Less scrolling with tabbed interface
3. More intuitive data type selection
4. Map charts show work-in-progress message