'use client';

import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ThemeToggleProps {
  collapsed?: boolean;
}

export function ThemeToggle({ collapsed = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';

  const toggle = () => setTheme(isDark ? 'light' : 'dark');
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  if (collapsed) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-label={label}
              data-testid="theme-toggle-collapsed"
              className="w-full p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors"
            >
              {isDark ? <Sun className="h-6 w-6" /> : <Moon className="h-6 w-6" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="ml-2">
            <p className="font-medium">{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Button
      variant="ghost"
      onClick={toggle}
      aria-label={label}
      data-testid="theme-toggle"
      className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#0066FF]/3 hover:text-[#002B5C] transition-colors justify-start"
    >
      {isDark ? (
        <Sun className="h-6 w-6 flex-shrink-0" />
      ) : (
        <Moon className="h-6 w-6 flex-shrink-0" />
      )}
      <span className="font-medium">{isDark ? 'Light mode' : 'Dark mode'}</span>
    </Button>
  );
}
