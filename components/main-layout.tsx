'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { NEXT_PUBLIC_WEBAPP_ENVIRONMENT } from '@/constants/constants';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useResponsiveLayout } from '@/hooks/useResponsiveLayout';
import {
  BarChart3,
  Database,
  Settings,
  FileText,
  AlertTriangle,
  ChevronDown,
  Home,
  LayoutDashboard,
  ChartBarBig,
  Grid3x3,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Info,
  CreditCard,
} from 'lucide-react';
import IngestIcon from '@/assets/icons/ingest';
import TransformIcon from '@/assets/icons/transform';
import OrchestrateIcon from '@/assets/icons/orchestrate';
import { Header } from './header';
import { useAuthStore } from '@/stores/authStore';
import Image from 'next/image';

// Define types for navigation items
interface NavItemType {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  children?: NavItemType[];
}

// Menu items to hide in production environment
const PRODUCTION_HIDDEN_ITEMS = [
  // Add menu item titles to hide in production
  'Metrics',
  'Reports',
  'Alerts',
];
// Function to filter menu items for production environment
const filterMenuItemsForProduction = (items: NavItemType[]): NavItemType[] => {
  if (NEXT_PUBLIC_WEBAPP_ENVIRONMENT !== 'production') {
    return items; // Show full menu for development and staging
  }

  return items.filter((item) => {
    // Check if the main item should be hidden in production
    if (PRODUCTION_HIDDEN_ITEMS.includes(item.title)) {
      return false;
    }

    // If item has children, filter them too
    if (item.children && item.children.length > 0) {
      const filteredChildren = item.children.filter(
        (child) => !PRODUCTION_HIDDEN_ITEMS.includes(child.title)
      );

      // If all children are hidden, hide the parent too
      if (filteredChildren.length === 0) {
        return false;
      }

      // Return item with filtered children
      return {
        ...item,
        children: filteredChildren,
      };
    }

    return true;
  });
};

// Define the navigation items with their routes and icons
const getNavItems = (currentPath: string, hasSupersetSetup: boolean = false): NavItemType[] => {
  // Build dashboard children based on Superset setup availability
  const dashboardChildren: NavItemType[] = [];
  if (hasSupersetSetup) {
    dashboardChildren.push({
      title: 'Usage',
      href: '/dashboards/usage',
      icon: BarChart3,
      isActive: currentPath === '/dashboards/usage',
    });
  }

  const allNavItems: NavItemType[] = [
    {
      title: 'Impact',
      href: '/impact',
      icon: Home,
      isActive: currentPath === '/impact',
    },
    {
      title: 'Metrics',
      href: '/metrics',
      icon: BarChart3,
      isActive: currentPath.startsWith('/metrics'),
    },
    {
      title: 'Charts',
      href: '/charts',
      icon: ChartBarBig,
      isActive: currentPath.startsWith('/charts'),
    },
    {
      title: 'Dashboards',
      href: '/dashboards',
      icon: LayoutDashboard,
      isActive:
        currentPath === '/dashboards' ||
        (currentPath.startsWith('/dashboards/') && !currentPath.startsWith('/dashboards/usage')),
      children: dashboardChildren.length > 0 ? dashboardChildren : undefined,
    },
    {
      title: 'Reports',
      href: '/reports',
      icon: FileText,
      isActive: currentPath.startsWith('/reports'),
    },
    {
      title: 'Data',
      href: '/ingest', // Direct navigation to ingest page
      icon: Database,
      isActive: false, // Never highlight the parent Data menu
      children: [
        {
          title: 'Overview',
          href: '/pipeline',
          icon: IngestIcon,
          isActive: currentPath.startsWith('/pipeline'),
        },
        {
          title: 'Ingest',
          href: '/ingest',
          icon: IngestIcon,
          isActive: currentPath.startsWith('/ingest'),
        },
        {
          title: 'Transform',
          href: '/transform',
          icon: TransformIcon,
          isActive: currentPath.startsWith('/transform'),
        },
        {
          title: 'Orchestrate',
          href: '/orchestrate',
          icon: OrchestrateIcon,
          isActive: currentPath.startsWith('/orchestrate'),
        },
        {
          title: 'Explore',
          href: '/explore',
          icon: IngestIcon,
          isActive: currentPath.startsWith('/explore'),
        },
        {
          title: 'Quality',
          href: '/data-quality',
          icon: IngestIcon,
          isActive: currentPath.startsWith('/data-quality'),
        },
      ],
    },
    {
      title: 'Alerts',
      href: '/alerts',
      icon: AlertTriangle,
      isActive: currentPath.startsWith('/alerts'),
    },
    {
      title: 'Settings',
      href: '/settings/about',
      icon: Settings,
      isActive: false, // Never highlight the parent Settings menu
      children: [
        {
          title: 'About',
          href: '/settings/about',
          icon: Info,
          isActive: currentPath === '/settings/about',
        },
        {
          title: 'Billing',
          href: '/settings/billing',
          icon: CreditCard,
          isActive: currentPath === '/settings/billing',
        },
      ],
    },
  ];

  // Filter menu items for production environment
  return filterMenuItemsForProduction(allNavItems);
};

// Flatten menu items for collapsed view
const getFlattenedNavItems = (items: NavItemType[]): NavItemType[] => {
  const flattened: NavItemType[] = [];

  items.forEach((item) => {
    if (item.children && item.title === 'Data') {
      // For Data parent, only include children (Ingest, Transform, Orchestrate) in collapsed mode
      flattened.push(...item.children);
    } else {
      // For other items, include the parent as usual
      flattened.push(item);
      if (item.children) {
        flattened.push(...item.children);
      }
    }
  });

  return flattened;
};

// Collapsed navigation item component
function CollapsedNavItem({ item }: { item: NavItemType }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            className={cn(
              'flex items-center justify-center w-full p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors group',
              item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
            )}
          >
            <item.icon className="h-6 w-6 flex-shrink-0" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right" className="ml-2">
          <p className="font-medium">{item.title}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Expanded navigation item component
function ExpandedNavItem({ item }: { item: NavItemType }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  // Auto-expand if any child is active, or for Data tab when on data-related pages
  useEffect(() => {
    if (hasChildren && item.children?.some((child) => child.isActive)) {
      setIsExpanded(true);
    } else if (item.title === 'Data' && item.children?.some((child) => child.isActive)) {
      // Always expand Data submenu when any data-related child is active
      setIsExpanded(true);
    }
  }, [item.children, hasChildren, item.title]);

  if (hasChildren) {
    // Special handling for Data tab - make it clickable and show submenu
    if (item.title === 'Data') {
      return (
        <div className="space-y-1">
          <div
            className={cn(
              'flex items-center rounded-lg transition-colors hover:bg-[#0066FF]/3 group',
              item.isActive && 'bg-[#0066FF]/10 hover:bg-[#0066FF]/10'
            )}
          >
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C] font-medium'
              )}
              title={item.title}
            >
              <item.icon className="h-6 w-6 flex-shrink-0" />
              <span className="font-medium">{item.title}</span>
            </Link>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'p-2 transition-colors rounded-r-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C]'
              )}
              title="Toggle submenu"
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform flex-shrink-0 text-muted-foreground group-hover:text-[#002B5C]',
                  isExpanded && 'rotate-180',
                  item.isActive && 'text-[#002B5C]'
                )}
              />
            </button>
          </div>

          {isExpanded && (
            <div className="ml-8 space-y-1">
              {item.children?.map((child, index) => (
                <Link
                  key={index}
                  href={child.href}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors text-sm',
                    child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
                  )}
                  title={child.title}
                >
                  <child.icon className="h-6 w-6 flex-shrink-0" />
                  <span>{child.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Default behavior for other items with children (Dashboards and Settings)
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'flex items-center rounded-lg transition-colors hover:bg-[#0066FF]/3 group',
            item.isActive && 'bg-[#0066FF]/10 hover:bg-[#0066FF]/10'
          )}
        >
          <Link
            href={item.href}
            className={cn(
              'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C] font-medium'
            )}
            title={item.title}
          >
            <item.icon className="h-6 w-6 flex-shrink-0" />
            <span className="font-medium">{item.title}</span>
          </Link>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'p-2 transition-colors rounded-r-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C]'
            )}
            title="Toggle submenu"
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform flex-shrink-0 text-muted-foreground group-hover:text-[#002B5C]',
                isExpanded && 'rotate-180',
                item.isActive && 'text-[#002B5C]'
              )}
            />
          </button>
        </div>

        {isExpanded && (
          <div className="ml-8 space-y-1">
            {item.children?.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors text-sm',
                  child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
                )}
                title={child.title}
              >
                <child.icon className="h-6 w-6 flex-shrink-0" />
                <span>{child.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors group',
        item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
      )}
      title={item.title}
    >
      <item.icon className="h-6 w-6 flex-shrink-0" />
      <span className="font-medium">{item.title}</span>
    </Link>
  );
}

// Mobile navigation item component
function MobileNavItem({ item, onClose }: { item: NavItemType; onClose: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasChildren = item.children && item.children.length > 0;

  // Auto-expand if any child is active, or for Data tab when on data-related pages
  useEffect(() => {
    if (hasChildren && item.children?.some((child) => child.isActive)) {
      setIsExpanded(true);
    } else if (item.title === 'Data' && item.isActive) {
      // Always expand Data submenu when on data-related pages
      setIsExpanded(true);
    }
  }, [item.children, hasChildren, item.title, item.isActive]);

  if (hasChildren) {
    // Special handling for Data tab in mobile view
    if (item.title === 'Data') {
      return (
        <div className="space-y-1">
          <div
            className={cn(
              'flex items-center rounded-lg transition-colors hover:bg-[#0066FF]/3 group',
              item.isActive && 'bg-[#0066FF]/10 hover:bg-[#0066FF]/10'
            )}
          >
            <Link
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C] font-medium'
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className="font-medium">{item.title}</span>
            </Link>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={cn(
                'p-2 transition-colors rounded-r-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C]'
              )}
            >
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform text-muted-foreground group-hover:text-[#002B5C]',
                  isExpanded && 'rotate-180',
                  item.isActive && 'text-[#002B5C]'
                )}
              />
            </button>
          </div>
          {isExpanded && (
            <div className="ml-8 space-y-1">
              {item.children?.map((child, index) => (
                <Link
                  key={index}
                  href={child.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors',
                    child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
                  )}
                >
                  <child.icon className="h-6 w-6 flex-shrink-0" />
                  <span className="text-sm">{child.title}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Default behavior for other items with children (Dashboards and Settings)
    return (
      <div className="space-y-1">
        <div
          className={cn(
            'flex items-center rounded-lg transition-colors hover:bg-[#0066FF]/3 group',
            item.isActive && 'bg-[#0066FF]/10 hover:bg-[#0066FF]/10'
          )}
        >
          <Link
            href={item.href}
            onClick={onClose}
            className={cn(
              'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C] font-medium'
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className="font-medium">{item.title}</span>
          </Link>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              'p-2 transition-colors rounded-r-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C]'
            )}
          >
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform text-muted-foreground group-hover:text-[#002B5C]',
                isExpanded && 'rotate-180',
                item.isActive && 'text-[#002B5C]'
              )}
            />
          </button>
        </div>
        {isExpanded && (
          <div className="ml-8 space-y-1">
            {item.children?.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors',
                  child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
                )}
              >
                <child.icon className="h-6 w-6 flex-shrink-0" />
                <span className="text-sm">{child.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors',
        item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-medium'
      )}
    >
      <item.icon className="h-6 w-6 flex-shrink-0" />
      <span className="font-medium">{item.title}</span>
    </Link>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasUserToggledSidebar, setHasUserToggledSidebar] = useState(false);
  const responsive = useResponsiveLayout();
  const { currentOrg } = useAuthStore();
  const hasSupersetSetup = Boolean(currentOrg?.viz_url);
  const navItems = getNavItems(pathname, hasSupersetSetup);
  const flattenedNavItems = getFlattenedNavItems(navItems);

  // Auto-collapse sidebar on specific dashboard/chart pages
  useEffect(() => {
    const shouldAutoCollapse =
      // Chart pages
      pathname === '/charts/create' ||
      pathname.match(/^\/charts\/[^\/]+\/edit$/) ||
      (pathname.match(/^\/charts\/[^\/]+$/) && !pathname.includes('/edit')) ||
      // Dashboard pages
      pathname === '/dashboards/create' ||
      pathname.match(/^\/dashboards\/[^\/]+\/edit$/) ||
      (pathname.match(/^\/dashboards\/[^\/]+$/) && !pathname.includes('/edit'));

    // Reset user toggle preference on page navigation
    setHasUserToggledSidebar(false);

    // Auto-collapse when navigating to these pages
    if (shouldAutoCollapse) {
      setIsSidebarCollapsed(true);
    }
  }, [pathname]);

  // Determine if sidebar should be shown based on screen size
  const shouldShowDesktopSidebar = responsive.isDesktop;
  const shouldUseMobileMenu = responsive.isMobile || responsive.isTablet;

  return (
    <div id="main-layout-root" className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* SECTION 1: NAVBAR - Fixed Full Width */}
      <header
        id="main-layout-navbar"
        className="h-16 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0 shadow-md"
      >
        <div id="main-layout-navbar-container" className="h-full px-4 lg:px-6">
          <Header
            onMenuToggle={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            hideMenu={false}
            responsive={responsive}
          />
        </div>
      </header>

      {/* CONTENT AREA: Remaining Height */}
      <div id="main-layout-content-area" className="flex h-[calc(100vh-4rem)]">
        {/* SECTION 2: SIDEBAR - Only show on desktop screens */}
        {shouldShowDesktopSidebar && (
          <aside
            id="main-layout-sidebar"
            className={cn(
              'flex flex-col border-r bg-background transition-all duration-300 flex-shrink-0',
              isSidebarCollapsed ? 'w-16' : 'w-64'
            )}
          >
            {/* Sidebar Navigation */}
            <div id="main-layout-sidebar-nav" className="flex-1 overflow-y-auto p-4 space-y-2">
              {isSidebarCollapsed
                ? // Collapsed: Show all items (including nested) as individual icons with tooltips
                  flattenedNavItems.map((item, index) => (
                    <CollapsedNavItem key={`${item.href}-${index}`} item={item} />
                  ))
                : // Expanded: Show hierarchical structure
                  navItems.map((item, index) => <ExpandedNavItem key={index} item={item} />)}
            </div>

            {/* Sidebar Toggle Button */}
            <div className="px-4 pb-2">
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsSidebarCollapsed(!isSidebarCollapsed);
                    setHasUserToggledSidebar(true);
                  }}
                  className={cn(
                    'h-8 w-8 text-[#0066FF] bg-[#0066FF]/8 hover:bg-[#0066FF]/15 hover:text-[#002B5C] transition-colors',
                    isSidebarCollapsed && 'mx-auto'
                  )}
                  title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  {isSidebarCollapsed ? (
                    <ChevronRight className="h-4 w-4" />
                  ) : (
                    <ChevronLeft className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Sidebar Footer */}
            <div id="main-layout-sidebar-footer" className="p-4 border-t space-y-2">
              {/* Footer Links */}
              <div className="space-y-1">
                {isSidebarCollapsed ? (
                  // Collapsed: Show icons with tooltips
                  <>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href="https://dalgot4d.github.io/dalgo_docs/" target="_blank">
                            <div className="flex items-center justify-center p-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                height="16"
                                viewBox="0 0 24 24"
                                width="16"
                                fill="currentColor"
                              >
                                <path d="M0 0h24v24H0z" fill="none" />
                                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                              </svg>
                            </div>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="ml-2">
                          <p className="font-medium">Documentation</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link href="https://dalgo.org/privacy-policy/" target="_blank">
                            <div className="flex items-center justify-center p-2 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground hover:text-foreground">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                height="16"
                                viewBox="0 0 24 24"
                                width="16"
                                fill="currentColor"
                              >
                                <path d="M0 0h24v24H0z" fill="none" />
                                <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                              </svg>
                            </div>
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="ml-2">
                          <p className="font-medium">Privacy Policy</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : (
                  // Expanded: Show full links with text
                  <>
                    <Link href="https://dalgot4d.github.io/dalgo_docs/" target="_blank">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground">
                        <span>Documentation</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="14"
                          viewBox="0 0 24 24"
                          width="14"
                          fill="currentColor"
                          className="flex-shrink-0"
                        >
                          <path d="M0 0h24v24H0z" fill="none" />
                          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                        </svg>
                      </div>
                    </Link>

                    <Link href="https://dalgo.org/privacy-policy/" target="_blank">
                      <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground">
                        <span>Privacy Policy</span>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          height="14"
                          viewBox="0 0 24 24"
                          width="14"
                          fill="currentColor"
                          className="flex-shrink-0"
                        >
                          <path d="M0 0h24v24H0z" fill="none" />
                          <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                        </svg>
                      </div>
                    </Link>
                  </>
                )}
              </div>
            </div>
          </aside>
        )}
        {/* Mobile Sidebar */}
        <Sheet
          id="main-layout-mobile-sidebar"
          open={isMobileMenuOpen}
          onOpenChange={setIsMobileMenuOpen}
        >
          <SheetContent id="main-layout-mobile-sidebar-content" side="left" className="p-0 w-72">
            <div id="main-layout-mobile-sidebar-wrapper" className="flex flex-col h-full">
              <div className="p-4 border-b">
                <div className="flex items-center gap-3">
                  <Image
                    src="/dalgo_logo.svg"
                    alt="Dalgo"
                    width={60}
                    height={68}
                    className="text-primary"
                  />
                </div>
              </div>

              <div className="flex-1 p-4 space-y-2 overflow-y-auto">
                {navItems.map((item, index) => (
                  <MobileNavItem
                    key={index}
                    item={item}
                    onClose={() => setIsMobileMenuOpen(false)}
                  />
                ))}
              </div>

              <div className="p-4 border-t space-y-2">
                {/* Footer Links */}
                <div className="space-y-1">
                  <Link href="https://dalgot4d.github.io/dalgo_docs/" target="_blank">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground">
                      <span>Documentation</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="14"
                        viewBox="0 0 24 24"
                        width="14"
                        fill="currentColor"
                        className="flex-shrink-0"
                      >
                        <path d="M0 0h24v24H0z" fill="none" />
                        <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                      </svg>
                    </div>
                  </Link>

                  <Link href="https://dalgo.org/privacy-policy/" target="_blank">
                    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/40 transition-colors text-sm text-muted-foreground hover:text-foreground">
                      <span>Privacy Policy</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        height="14"
                        viewBox="0 0 24 24"
                        width="14"
                        fill="currentColor"
                        className="flex-shrink-0"
                      >
                        <path d="M0 0h24v24H0z" fill="none" />
                        <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
                      </svg>
                    </div>
                  </Link>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* SECTION 3: MAIN CONTENT AREA - Remaining Width */}
        <main id="main-layout-main-content" className="flex-1 overflow-hidden bg-gray-50">
          {/* Page Container - Dashboard pages handle their own scrolling */}
          <div id="main-layout-page-container" className="h-full w-full">
            {/* Consistent Inner Padding Container - No padding for dashboard pages */}
            <div id="main-layout-inner-container" className="h-full">
              {/* Content Area */}
              <div id="main-layout-content-wrapper" className="h-full w-full">
                {children}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
