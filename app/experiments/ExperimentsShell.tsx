'use client';

import { useState, useEffect } from 'react';
import {
  Home,
  BarChart3,
  ChartBarBig,
  LayoutDashboard,
  FileText,
  AlertTriangle,
  Database,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const NOORA_LOGO_URL =
  'https://noorahealth.org/wp-content/uploads/2023/06/Noora-Health-Logo_Horizontal-Full-Color-1.png';

const NAV_ITEMS = [
  { title: 'Impact', icon: Home, isActive: false },
  { title: 'Metrics', icon: BarChart3, isActive: true },
  { title: 'Charts', icon: ChartBarBig, isActive: false },
  { title: 'Dashboards', icon: LayoutDashboard, isActive: false },
  { title: 'Reports', icon: FileText, isActive: false },
  { title: 'Alerts', icon: AlertTriangle, isActive: false },
  { title: 'Data', icon: Database, hasChildren: true },
  { title: 'Settings', icon: Settings, hasChildren: true },
];

function NavItem({
  title,
  icon: Icon,
  isActive,
  hasChildren,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive?: boolean;
  hasChildren?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg transition-colors group cursor-default',
        'hover:bg-[#0066FF]/3 hover:text-[#002B5C]',
        isActive && 'bg-[#0066FF]/10 text-[#002B5C] font-bold'
      )}
    >
      <Icon className="h-6 w-6 flex-shrink-0" />
      <span className={cn('font-medium', isActive && 'font-bold')}>{title}</span>
      {hasChildren && (
        <ChevronDown className="h-4 w-4 flex-shrink-0 text-muted-foreground ml-auto" />
      )}
    </div>
  );
}

export function ExperimentsShell({ children }: { children: React.ReactNode }) {
  const [isDesktop, setIsDesktop] = useState(true);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  return (
    <div id="experiments-shell-root" className="h-screen w-screen overflow-hidden bg-gray-50">
      {/* Content area: sidebar + right column */}
      <div className="flex h-full">
        {/* LEFT SIDEBAR */}
        {isDesktop && (
          <aside
            id="experiments-sidebar"
            className="w-64 flex flex-col border-r bg-background flex-shrink-0"
          >
            {/* Org context bar */}
            <div className="flex-shrink-0 p-3 bg-muted/50 border-b">
              <div className="flex items-center gap-2">
                <img src={NOORA_LOGO_URL} alt="Noora Health" className="h-5 w-auto" />
                <span className="text-xs text-muted-foreground">CCP</span>
              </div>
            </div>

            {/* Dalgo logo area */}
            <div className="flex-shrink-0 p-4 flex items-center gap-3 border-b">
              <div className="w-10 h-10 rounded-lg bg-[#0066FF] flex items-center justify-center">
                <span className="text-white font-bold text-lg">D</span>
              </div>
              <span className="font-semibold text-foreground">Dalgo</span>
            </div>

            {/* Nav items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {NAV_ITEMS.map((item) => (
                <NavItem
                  key={item.title}
                  title={item.title}
                  icon={item.icon}
                  isActive={item.isActive}
                  hasChildren={item.hasChildren}
                />
              ))}
            </div>

            {/* User area at bottom */}
            <div className="flex-shrink-0 p-4 border-t">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#E0F2FE] flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-blue-700">AN</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm truncate">Ananya Sharma</div>
                  <div className="text-xs text-muted-foreground">M&E Lead</div>
                  <div className="text-xs text-muted-foreground/80">Noora Health</div>
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* RIGHT COLUMN: gradient, header, content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Gradient stripe */}
          <div
            className="h-[3px] flex-shrink-0"
            style={{
              background: 'linear-gradient(to right, #00A89D, #F7941D, #ED1C8E, #00AEEF)',
            }}
          />

          {/* Top header */}
          <header className="h-16 flex-shrink-0 border-b bg-background/95 backdrop-blur flex items-center justify-between px-4 lg:px-6">
            <img src={NOORA_LOGO_URL} alt="Noora Health" className="h-7 w-auto" />
            <span className="text-sm text-muted-foreground">Care Companion Program · Q4 FY26</span>
          </header>

          {/* Main content */}
          <main className="flex-1 overflow-hidden bg-gray-50 flex flex-col">
            <div className="flex-1 overflow-y-auto">{children}</div>
            {/* Footer */}
            <footer className="flex-shrink-0 py-3 text-center text-xs text-muted-foreground border-t bg-background/50">
              Prototype · Art of the Possible Spike · Built on the Dalgo codebase
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
}
