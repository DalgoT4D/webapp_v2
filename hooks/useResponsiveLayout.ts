import { useState, useEffect } from 'react';

export type ResponsiveBreakpoint = 'mobile' | 'tablet' | 'desktop';

interface ResponsiveLayoutConfig {
  mobile: { maxWidth: 767 };
  tablet: { minWidth: 768; maxWidth: 1199 };
  desktop: { minWidth: 1200 };
}

const BREAKPOINTS: ResponsiveLayoutConfig = {
  mobile: { maxWidth: 767 },
  tablet: { minWidth: 768, maxWidth: 1199 },
  desktop: { minWidth: 1200 },
};

/**
 * Hook to detect responsive breakpoints and suggest optimal filter layout
 */
export function useResponsiveLayout() {
  const [currentBreakpoint, setCurrentBreakpoint] = useState<ResponsiveBreakpoint>('desktop');
  const [windowWidth, setWindowWidth] = useState<number>(0);

  useEffect(() => {
    const updateBreakpoint = () => {
      const width = window.innerWidth;
      setWindowWidth(width);

      if (width <= BREAKPOINTS.mobile.maxWidth) {
        setCurrentBreakpoint('mobile');
      } else if (width >= BREAKPOINTS.tablet.minWidth && width <= BREAKPOINTS.tablet.maxWidth) {
        setCurrentBreakpoint('tablet');
      } else {
        setCurrentBreakpoint('desktop');
      }
    };

    // Set initial breakpoint
    updateBreakpoint();

    // Add resize listener
    window.addEventListener('resize', updateBreakpoint);

    return () => window.removeEventListener('resize', updateBreakpoint);
  }, []);

  /**
   * Get the recommended filter layout based on current breakpoint
   */
  const getRecommendedFilterLayout = (): 'vertical' | 'horizontal' => {
    switch (currentBreakpoint) {
      case 'mobile':
        return 'horizontal'; // Mobile always uses horizontal for space
      case 'tablet':
        return 'horizontal'; // Tablet should use horizontal for better chart width
      case 'desktop':
        return 'vertical'; // Desktop has space for sidebar
      default:
        return 'vertical';
    }
  };

  /**
   * Check if current screen size benefits from responsive filter layout
   */
  const shouldUseResponsiveLayout = (): boolean => {
    return currentBreakpoint === 'tablet' || currentBreakpoint === 'mobile';
  };

  return {
    currentBreakpoint,
    windowWidth,
    recommendedFilterLayout: getRecommendedFilterLayout(),
    shouldUseResponsiveLayout: shouldUseResponsiveLayout(),
    isMobile: currentBreakpoint === 'mobile',
    isTablet: currentBreakpoint === 'tablet',
    isDesktop: currentBreakpoint === 'desktop',
  };
}
