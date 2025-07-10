# Dalgo Web Application

A modern web application built with Next.js 15 and React 19, featuring a comprehensive dashboard system with data visualization, analytics, and reporting capabilities.

## Tech Stack

### Core Technologies
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety and developer experience
- **Tailwind CSS** - Utility-first styling

### State Management & Data Fetching
- **Zustand** - Lightweight state management
- **SWR** - Data fetching and caching
- **React Hook Form** - Form handling and validation

### UI Components & Styling
- **Radix UI** - Headless UI components
- **Class Variance Authority** - Component styling variants
- **Tailwind Merge** - Utility class merging
- **Lucide React** - Icon system

### Data Visualization
- **ECharts** - Interactive charting library
- **Nivo** - Data visualization components
- **Recharts** - Composable chart library

### Development & Testing
- **Jest** - Testing framework
- **React Testing Library** - Component testing
- **Husky** - Git hooks
- **Prettier** - Code formatting
- **ESLint** - Code linting

## Project Structure

```
webapp_v2/
├── app/                    # Next.js app router pages
├── components/            
│   ├── ui/                # Reusable UI components
│   ├── charts/            # Chart components
│   ├── dashboard/         # Dashboard-specific components
│   └── alerts/            # Alert system components
├── hooks/                 # Custom React hooks
├── stores/                # Zustand store definitions
├── lib/                   # Utility functions and API
├── constants/             # Application constants
└── tests/                 # Test files
```

## Key Features

- **Dashboard System** - Customizable dashboards with drag-and-drop capabilities
- **Data Visualization** - Multiple charting libraries for different visualization needs
- **Alert System** - Real-time notification and alert management
- **Authentication** - Protected routes and auth management
- **Responsive Design** - Mobile-first approach with responsive layouts

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Run development server:
```bash
npm run dev
```

3. Open [http://localhost:3001](http://localhost:3001)

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build production bundle
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run format:write` - Format code with Prettier
