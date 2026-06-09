/**
 * Dashboard Animation Hook
 * Provides magnetic snapping, smooth animations, and auto-arrangement functionality
 */

import { useCallback, useRef, useState, useEffect } from 'react';
import {
  Position,
  Size,
  ComponentBounds,
  SnapZone,
  AnimationConfig,
  SpaceMakingConfig,
  AffectedComponent,
  calculateSnapZones,
  applyMagneticSnapping,
  createTransitionStyles,
  detectSpaceMakingNeeds,
  calculateSpaceMakingLayout,
  ANIMATION_PRESETS,
  DEFAULT_SPACE_MAKING_CONFIG,
  SNAP_THRESHOLD,
} from '@/lib/dashboard-animation-utils';

interface DashboardLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
}

interface UseDashboardAnimationProps {
  gridCols: number;
  containerWidth: number;
  rowHeight: number;
  enabled?: boolean;
  spaceMakingConfig?: Partial<SpaceMakingConfig>;
}

interface AnimationState {
  isAnimating: boolean;
  animatingComponents: Set<string>;
  snapZones: SnapZone[];
  affectedComponents: AffectedComponent[];
  spaceMakingActive: boolean;
}

export function useDashboardAnimation({
  gridCols,
  containerWidth,
  rowHeight,
  enabled = true,
  spaceMakingConfig = {},
}: UseDashboardAnimationProps) {
  const [animationState, setAnimationState] = useState<AnimationState>({
    isAnimating: false,
    animatingComponents: new Set(),
    snapZones: [],
    affectedComponents: [],
    spaceMakingActive: false,
  });

  // Merge user config with defaults
  const spaceMakingConfigRef = useRef<SpaceMakingConfig>({
    ...DEFAULT_SPACE_MAKING_CONFIG,
    ...spaceMakingConfig,
  });

  const snapZonesRef = useRef<SnapZone[]>([]);

  // Calculate column width
  const colWidth = containerWidth / gridCols;

  /**
   * Update snap zones based on current layout
   */
  const updateSnapZones = useCallback(
    (layout: DashboardLayout[]) => {
      if (!enabled) return;

      const componentBounds: ComponentBounds[] = layout.map((item) => ({
        x: item.x,
        y: item.y * rowHeight,
        w: item.w,
        h: item.h * rowHeight,
      }));

      const zones = calculateSnapZones(gridCols, containerWidth, componentBounds);
      snapZonesRef.current = zones;

      setAnimationState((prev) => ({
        ...prev,
        snapZones: zones,
      }));
    },
    [gridCols, containerWidth, rowHeight, enabled]
  );

  /**
   * Apply magnetic snapping to a layout item during drag
   */
  const applySnapping = useCallback(
    (item: DashboardLayout, layout: DashboardLayout[]): DashboardLayout => {
      if (!enabled) return item;

      const position: Position = { x: item.x, y: item.y };
      const size: Size = { w: item.w, h: item.h };

      const snappedPosition = applyMagneticSnapping(position, size, snapZonesRef.current, colWidth);

      // Ensure snapped position is within grid bounds
      const clampedX = Math.max(0, Math.min(snappedPosition.x, gridCols - item.w));
      const clampedY = Math.max(0, snappedPosition.y);

      return {
        ...item,
        x: Math.round(clampedX),
        y: Math.round(clampedY),
      };
    },
    [enabled, colWidth, gridCols]
  );

  /**
   * Create animation styles for a component
   */
  const getAnimationStyles = useCallback(
    (
      componentId: string,
      preset: keyof typeof ANIMATION_PRESETS = 'smooth'
    ): React.CSSProperties => {
      if (!enabled) return {};

      const config = ANIMATION_PRESETS[preset];
      const isAnimating = animationState.animatingComponents.has(componentId);

      if (isAnimating) {
        return createTransitionStyles(config);
      }

      return {};
    },
    [enabled, animationState.animatingComponents]
  );

  /**
   * Push components away from dragged component
   */
  const pushAway = useCallback(
    (
      draggedItem: DashboardLayout,
      layout: DashboardLayout[],
      pushRadius: number = 2
    ): DashboardLayout[] => {
      if (!enabled) return layout;

      const result = [...layout];
      const draggedBounds = {
        left: draggedItem.x,
        right: draggedItem.x + draggedItem.w,
        top: draggedItem.y,
        bottom: draggedItem.y + draggedItem.h,
      };

      result.forEach((item, index) => {
        if (item.i === draggedItem.i) return;

        const itemBounds = {
          left: item.x,
          right: item.x + item.w,
          top: item.y,
          bottom: item.y + item.h,
        };

        // Check if items are close enough to push
        const horizontalOverlap =
          Math.min(draggedBounds.right, itemBounds.right) -
          Math.max(draggedBounds.left, itemBounds.left);
        const verticalOverlap =
          Math.min(draggedBounds.bottom, itemBounds.bottom) -
          Math.max(draggedBounds.top, itemBounds.top);

        if (horizontalOverlap > 0 && verticalOverlap > 0) {
          // Calculate push direction
          const centerX = draggedItem.x + draggedItem.w / 2;
          const centerY = draggedItem.y + draggedItem.h / 2;
          const itemCenterX = item.x + item.w / 2;
          const itemCenterY = item.y + item.h / 2;

          const deltaX = itemCenterX - centerX;
          const deltaY = itemCenterY - centerY;

          // Push in the direction of greater separation
          if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Push horizontally
            const pushDirection = deltaX > 0 ? 1 : -1;
            const newX = Math.max(
              0,
              Math.min(gridCols - item.w, item.x + pushDirection * pushRadius)
            );
            result[index] = { ...item, x: newX };
          } else {
            // Push vertically
            const pushDirection = deltaY > 0 ? 1 : -1;
            const newY = Math.max(0, item.y + pushDirection * pushRadius);
            result[index] = { ...item, y: newY };
          }
        }
      });

      return result;
    },
    [enabled, gridCols]
  );

  /**
   * Animate single component to new position
   */
  const animateComponent = useCallback(
    (componentId: string, duration: number = 400) => {
      if (!enabled) return;

      setAnimationState((prev) => ({
        ...prev,
        animatingComponents: new Set([...prev.animatingComponents, componentId]),
      }));

      setTimeout(() => {
        setAnimationState((prev) => {
          const newAnimating = new Set(prev.animatingComponents);
          newAnimating.delete(componentId);
          return {
            ...prev,
            animatingComponents: newAnimating,
          };
        });
      }, duration);
    },
    [enabled]
  );

  /**
   * Check if should show snap indicators
   */
  const shouldShowSnapIndicators = useCallback(
    (draggedItem: DashboardLayout): SnapZone[] => {
      if (!enabled) return [];

      const position: Position = { x: draggedItem.x, y: draggedItem.y };
      const size: Size = { w: draggedItem.w, h: draggedItem.h };

      return snapZonesRef.current.filter((zone) => {
        const distance =
          zone.direction === 'vertical'
            ? Math.abs(position.x - zone.position.x / colWidth)
            : Math.abs(position.y - zone.position.y / rowHeight);

        return distance <= SNAP_THRESHOLD;
      });
    },
    [enabled, colWidth, rowHeight]
  );

  /**
   * Apply real-time space making during drag
   */
  const applyRealtimeSpaceMaking = useCallback(
    (draggedItem: DashboardLayout, layout: DashboardLayout[]): DashboardLayout[] => {
      if (!enabled || !spaceMakingConfigRef.current.enabled) {
        return layout;
      }

      // Convert layout to ComponentBounds format
      const componentBounds: ComponentBounds[] = layout.map((item) => ({
        x: item.x,
        y: item.y,
        w: item.w,
        h: item.h,
      }));

      const draggedBounds: ComponentBounds = {
        x: draggedItem.x,
        y: draggedItem.y,
        w: draggedItem.w,
        h: draggedItem.h,
      };

      // Calculate space-making layout
      const spaceMadeLayout = calculateSpaceMakingLayout(
        draggedBounds,
        componentBounds,
        gridCols,
        spaceMakingConfigRef.current
      );

      // Convert back to DashboardLayout format
      const result = layout.map((item, index) => ({
        ...item,
        x: spaceMadeLayout[index].x,
        y: spaceMadeLayout[index].y,
      }));

      // Detect affected components for visual feedback
      const affected = detectSpaceMakingNeeds(
        draggedBounds,
        componentBounds,
        gridCols,
        spaceMakingConfigRef.current
      );

      // Update animation state with affected components
      if (affected.length > 0) {
        setAnimationState((prev) => ({
          ...prev,
          affectedComponents: affected,
          spaceMakingActive: true,
        }));
      } else {
        setAnimationState((prev) => ({
          ...prev,
          affectedComponents: [],
          spaceMakingActive: false,
        }));
      }

      return result;
    },
    [enabled, gridCols]
  );

  /**
   * Clear space-making state
   */
  const clearSpaceMaking = useCallback(() => {
    setAnimationState((prev) => ({
      ...prev,
      affectedComponents: [],
      spaceMakingActive: false,
    }));
  }, []);

  /**
   * Update space-making configuration
   */
  const updateSpaceMakingConfig = useCallback((newConfig: Partial<SpaceMakingConfig>) => {
    spaceMakingConfigRef.current = {
      ...spaceMakingConfigRef.current,
      ...newConfig,
    };
  }, []);

  return {
    // State
    isAnimating: animationState.isAnimating,
    animatingComponents: animationState.animatingComponents,
    snapZones: animationState.snapZones,
    affectedComponents: animationState.affectedComponents,
    spaceMakingActive: animationState.spaceMakingActive,

    // Functions
    updateSnapZones,
    applySnapping,
    getAnimationStyles,
    pushAway,
    animateComponent,
    shouldShowSnapIndicators,
    applyRealtimeSpaceMaking,
    clearSpaceMaking,
    updateSpaceMakingConfig,

    // Configuration
    enabled,
    spaceMakingConfig: spaceMakingConfigRef.current,
  };
}
