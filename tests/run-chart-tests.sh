#!/bin/bash

echo "🧪 Running Chart Feature Tests"
echo "=============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo -e "\n${YELLOW}Checking backend connection...${NC}"
if curl -s http://localhost:8002/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend is running${NC}"
else
    echo -e "${RED}✗ Backend is not running on port 8002${NC}"
    echo "Please start the Django backend first: cd DDP_backend && uvicorn ddpui.asgi:application --port 8002"
    exit 1
fi

# Run ChartCard tests
echo -e "\n${YELLOW}Running ChartCard tests...${NC}"
npm test -- tests/components/ChartCard.test.tsx --silent
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ChartCard tests passed${NC}"
else
    echo -e "${RED}✗ ChartCard tests failed${NC}"
fi

# Run ChartBuilder tests
echo -e "\n${YELLOW}Running ChartBuilder tests...${NC}"
npm test -- tests/components/ChartBuilder.test.tsx --silent
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ChartBuilder tests passed${NC}"
else
    echo -e "${RED}✗ ChartBuilder tests failed${NC}"
fi

# Run ChartPreview tests
echo -e "\n${YELLOW}Running ChartPreview tests...${NC}"
npm test -- tests/components/ChartPreview.test.tsx --silent
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ChartPreview tests passed${NC}"
else
    echo -e "${RED}✗ ChartPreview tests failed${NC}"
fi

# Run API tests
echo -e "\n${YELLOW}Running Chart API tests...${NC}"
npm test -- tests/api/chart-api.test.ts --silent
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Chart API tests passed${NC}"
else
    echo -e "${RED}✗ Chart API tests failed${NC}"
fi

# Run Integration tests
echo -e "\n${YELLOW}Running Integration tests...${NC}"
npm test -- tests/integration/chart-flow.test.tsx --silent
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Integration tests passed${NC}"
else
    echo -e "${RED}✗ Integration tests failed${NC}"
fi

# Run all tests with coverage
echo -e "\n${YELLOW}Running all tests with coverage...${NC}"
npm run test:coverage -- --testPathPattern="chart" --silent

echo -e "\n${GREEN}Test run complete!${NC}"