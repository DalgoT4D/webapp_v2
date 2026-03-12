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
  ChevronLeft,
  ChevronRight,
  Info,
  CreditCard,
  Users,
} from 'lucide-react';
import IngestIcon from '@/assets/icons/ingest';
import TransformIcon from '@/assets/icons/transform';
import ExploreIcon from '@/assets/icons/explore';
import DataQualityIcon from '@/assets/icons/data-quality';
import PipelineOverviewIcon from '@/assets/icons/pipeline-overview';
import OrchestrateIcon from '@/assets/icons/orchestrate';
import { Header } from './header';
import { useAuthStore } from '@/stores/authStore';
import { useFeatureFlags, FeatureFlagKeys } from '@/hooks/api/useFeatureFlags';
import { TransformType, useTransformType } from '@/hooks/api/useTransformType';
import Image from 'next/image';

// Define types for navigation items
interface NavItemType {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  children?: NavItemType[];
  hide?: boolean; // Add hide property for feature flag control
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
const getNavItems = (
  currentPath: string,
  hasSupersetSetup: boolean = false,
  isFeatureFlagEnabled: (flag: FeatureFlagKeys) => boolean,
  transformType?: string
): NavItemType[] => {
  // Build dashboard children based on feature flags AND Superset setup
  const dashboardChildren: NavItemType[] = [];

  // Add Usage Dashboard if BOTH feature flag is enabled AND org has Superset setup
  if (isFeatureFlagEnabled(FeatureFlagKeys.USAGE_DASHBOARD) && hasSupersetSetup) {
    dashboardChildren.push({
      title: 'Superset Usage',
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
      href: '/pipeline', // Direct navigation to overview page (default)
      icon: Database,
      isActive: false, // Never highlight the parent Data menu
      children: [
        {
          title: 'Overview',
          href: '/pipeline',
          icon: PipelineOverviewIcon,
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
          icon: ExploreIcon,
          isActive: currentPath.startsWith('/explore'),
        },
        {
          title: 'Quality',
          href: '/data-quality',
          icon: DataQualityIcon,
          isActive: currentPath.startsWith('/data-quality'),
          hide:
            !isFeatureFlagEnabled(FeatureFlagKeys.DATA_QUALITY) ||
            transformType === TransformType.UI,
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
      href: '/settings/billing',
      icon: Settings,
      isActive: false, // Never highlight the parent Settings menu
      children: [
        {
          title: 'Billing',
          href: '/settings/billing',
          icon: CreditCard,
          isActive: currentPath.startsWith('/settings/billing'),
        },
        {
          title: 'User Management',
          href: '/settings/user-management',
          icon: Users,
          isActive: currentPath.startsWith('/settings/user-management'),
        },
        {
          title: 'About',
          href: '/settings/about',
          icon: Info,
          isActive: currentPath.startsWith('/settings/about'),
        },
      ],
    },
  ];

  // Filter menu items for production environment
  return filterMenuItemsForProduction(allNavItems);
};

// Flatten menu items for collapsed view based on expanded state
const getFlattenedNavItems = (
  items: NavItemType[],
  expandedStates: Record<string, boolean>
): NavItemType[] => {
  const flattened: NavItemType[] = [];

  items.forEach((item) => {
    // Skip hidden items
    if (item.hide) return;

    // Always include the parent item
    flattened.push(item);

    // Include visible children if the parent is expanded
    if (item.children && expandedStates[item.title]) {
      // Only include non-hidden children
      const visibleChildren = item.children.filter((child) => !child.hide);
      flattened.push(...visibleChildren);
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
              item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
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
function ExpandedNavItem({
  item,
  isExpanded,
  onToggle,
}: {
  item: NavItemType;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Filter out hidden children
  const visibleChildren = item.children?.filter((child) => !child.hide) || [];
  const hasChildren = visibleChildren.length > 0;

  // Auto-expand if any child is active
  useEffect(() => {
    if (!isExpanded && hasChildren && visibleChildren.some((child) => child.isActive)) {
      onToggle(); // Expand if a child is active
    }
  }, []);

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
              onClick={() => {
                // Expand the menu when navigating to show the selected item
                if (!isExpanded) {
                  onToggle();
                }
              }}
              className={cn(
                'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C] font-bold'
              )}
              title={item.title}
            >
              <item.icon className="h-6 w-6 flex-shrink-0" />
              <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
            </Link>
            <button
              onClick={onToggle}
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
              {visibleChildren.map((child, index) => (
                <Link
                  key={index}
                  href={child.href}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors text-sm',
                    child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
                  )}
                  title={child.title}
                >
                  <child.icon
                    className={cn(
                      'flex-shrink-0',
                      child.title === 'About' || child.title === 'Billing' ? 'h-5 w-5' : 'h-6 w-6'
                    )}
                  />
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
            onClick={() => {
              // Expand the menu when navigating to show the selected item
              if (!isExpanded) {
                onToggle();
              }
            }}
            className={cn(
              'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C] font-bold'
            )}
            title={item.title}
          >
            <item.icon className="h-6 w-6 flex-shrink-0" />
            <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
          </Link>
          <button
            onClick={onToggle}
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
            {visibleChildren.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors text-sm',
                  child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
                )}
                title={child.title}
              >
                <child.icon
                  className={cn(
                    'flex-shrink-0',
                    child.title === 'About' || child.title === 'Billing' ? 'h-5 w-5' : 'h-6 w-6'
                  )}
                />
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
        item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
      )}
      title={item.title}
    >
      <item.icon className="h-6 w-6 flex-shrink-0" />
      <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
    </Link>
  );
}

// Mobile navigation item component
function MobileNavItem({
  item,
  onClose,
  isExpanded,
  onToggle,
}: {
  item: NavItemType;
  onClose: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  // Filter out hidden children
  const visibleChildren = item.children?.filter((child) => !child.hide) || [];
  const hasChildren = visibleChildren.length > 0;

  // Auto-expand if any child is active
  useEffect(() => {
    if (!isExpanded && hasChildren && visibleChildren.some((child) => child.isActive)) {
      onToggle(); // Expand if a child is active
    }
  }, []);

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
              onClick={() => {
                // Expand the menu when navigating and close mobile menu
                if (!isExpanded) {
                  onToggle();
                }
                onClose();
              }}
              className={cn(
                'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
                item.isActive && 'text-[#002B5C] font-bold'
              )}
            >
              <item.icon className="h-6 w-6" />
              <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
            </Link>
            <button
              onClick={onToggle}
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
              {visibleChildren.map((child, index) => (
                <Link
                  key={index}
                  href={child.href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors',
                    child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
                  )}
                >
                  <child.icon
                    className={cn(
                      'flex-shrink-0',
                      child.title === 'About' || child.title === 'Billing' ? 'h-5 w-5' : 'h-6 w-6'
                    )}
                  />
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
            onClick={() => {
              // Expand the menu when navigating and close mobile menu
              if (!isExpanded) {
                onToggle();
              }
              onClose();
            }}
            className={cn(
              'flex items-center gap-3 p-3 transition-colors flex-1 rounded-l-lg group-hover:text-[#002B5C]',
              item.isActive && 'text-[#002B5C] font-bold'
            )}
          >
            <item.icon className="h-6 w-6" />
            <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
          </Link>
          <button
            onClick={onToggle}
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
            {visibleChildren.map((child, index) => (
              <Link
                key={index}
                href={child.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors',
                  child.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
                )}
              >
                <child.icon
                  className={cn(
                    'flex-shrink-0',
                    child.title === 'About' || child.title === 'Billing' ? 'h-5 w-5' : 'h-6 w-6'
                  )}
                />
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
        item.isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
      )}
    >
      <item.icon className="h-6 w-6 flex-shrink-0" />
      <span className={cn('font-medium', item.isActive && 'font-bold')}>{item.title}</span>
    </Link>
  );
}

export function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [hasUserToggledSidebar, setHasUserToggledSidebar] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<Record<string, boolean>>({});
  const responsive = useResponsiveLayout();
  const { currentOrg } = useAuthStore();
  const { isFeatureFlagEnabled } = useFeatureFlags();
  const { transformType } = useTransformType();
  const hasSupersetSetup = Boolean(currentOrg?.viz_url);
  const navItems = getNavItems(pathname, hasSupersetSetup, isFeatureFlagEnabled, transformType);
  const flattenedNavItems = getFlattenedNavItems(navItems, expandedMenus);

  // Toggle menu expansion state
  const toggleMenuExpansion = (title: string) => {
    setExpandedMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  };

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
              'flex flex-col border-r bg-background transition-all duration-300 flex-shrink-0 relative',
              isSidebarCollapsed ? 'w-16' : 'w-64'
            )}
          >
            {/* Lightweight Collapse Button - Top Edge */}
            <div className="absolute top-6 -right-3 z-20">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsSidebarCollapsed(!isSidebarCollapsed);
                  setHasUserToggledSidebar(true);
                }}
                className={cn(
                  'h-6 w-6 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200/60 shadow-sm hover:bg-white hover:shadow-md transition-all duration-200',
                  'text-gray-400 hover:text-gray-600',
                  'opacity-75 hover:opacity-100'
                )}
                title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                {isSidebarCollapsed ? (
                  <ChevronRight className="h-5 w-5" />
                ) : (
                  <ChevronLeft className="h-5 w-5" />
                )}
              </Button>
            </div>

            {/* Sidebar Navigation */}
            <div id="main-layout-sidebar-nav" className="flex-1 overflow-y-auto p-4 space-y-2">
              {isSidebarCollapsed
                ? // Collapsed: Show all items (including nested) as individual icons with tooltips
                  flattenedNavItems
                    .filter((item) => !item.hide)
                    .map((item, index) => (
                      <CollapsedNavItem key={`${item.href}-${index}`} item={item} />
                    ))
                : // Expanded: Show hierarchical structure
                  navItems
                    .filter((item) => !item.hide)
                    .map((item, index) => (
                      <ExpandedNavItem
                        key={index}
                        item={item}
                        isExpanded={expandedMenus[item.title] || false}
                        onToggle={() => toggleMenuExpansion(item.title)}
                      />
                    ))}
            </div>
          </aside>
        )}
        {/* Mobile Sidebar */}
        <Sheet
          key="main-layout-mobile-sidebar"
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
                {navItems
                  .filter((item) => !item.hide)
                  .map((item, index) => (
                    <MobileNavItem
                      key={index}
                      item={item}
                      onClose={() => setIsMobileMenuOpen(false)}
                      isExpanded={expandedMenus[item.title] || false}
                      onToggle={() => toggleMenuExpansion(item.title)}
                    />
                  ))}
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
