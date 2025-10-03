/**
 * Dashboard Animation Utilities
 * Provides smooth animations, magnetic snapping, and auto-arrangement for dashboard components
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  w: number;
  h: number;
}

export interface ComponentBounds extends Position, Size {}

export interface SnapZone {
  type: 'grid' | 'component_edge' | 'center_line';
  position: Position;
  strength: number; // 0-1, higher = stronger magnetic pull
  direction: 'horizontal' | 'vertical' | 'both';
}

export interface AutoArrangeOptions {
  algorithm: 'pack' | 'flow' | 'distribute';
  spacing: number;
  maintainAspectRatio: boolean;
  respectUserPositions: boolean;
  animationDuration: number;
}

export interface SpaceMakingConfig {
  anticipationRadius: number; // How close before components start moving
  pushForce: number; // How far components get pushed
  cascadeDepth: number; // How many levels of pushing to allow
  animationStagger: number; // Delay between cascaded movements
  returnToOriginal: boolean; // Whether to return when drag is cancelled
  enabled: boolean; // Master enable/disable
}

export interface PushDirection {
  x: number; // -1 (left), 0 (none), 1 (right)
  y: number; // -1 (up), 0 (none), 1 (down)
  distance: number; // How far to push
  priority: number; // 0-1, higher priority moves first
}

export interface AffectedComponent {
  componentId: string;
  originalPosition: Position;
  targetPosition: Position;
  pushDirection: PushDirection;
  animationDelay: number;
}

export interface AnimationConfig {
  duration: number;
  easing: string;
  stagger: number; // delay between multiple animations
}

// Configuration constants
export const SNAP_THRESHOLD = 10; // pixels
export const MAGNETIC_ZONES = {
  GRID_LINES: 5, // Snap to grid lines
  COMPONENT_EDGES: 8, // Snap to other component edges
  CENTER_LINES: 12, // Snap to center alignment
};

export const INTERACTION_ZONES = {
  ANTICIPATION: 3, // Start subtle preparation movement
  ACTIVE_PUSH: 1.5, // Active displacement
  OVERLAP: 0.5, // Direct collision handling
};

export const DEFAULT_SPACE_MAKING_CONFIG: SpaceMakingConfig = {
  anticipationRadius: 3,
  pushForce: 2,
  cascadeDepth: 2,
  animationStagger: 100,
  returnToOriginal: true,
  enabled: true,
};

export const ANIMATION_PRESETS: Record<string, AnimationConfig> = {
  smooth: {
    duration: 400,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // spring-like
    stagger: 50,
  },
  fast: {
    duration: 200,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)', // material design
    stagger: 25,
  },
  slow: {
    duration: 600,
    easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // ease-out-quad
    stagger: 100,
  },
};

export const AUTO_ARRANGE_PRESETS: Record<string, AutoArrangeOptions> = {
  dashboard: {
    algorithm: 'pack',
    spacing: 4,
    maintainAspectRatio: true,
    respectUserPositions: false,
    animationDuration: 400,
  },
  presentation: {
    algorithm: 'distribute',
    spacing: 8,
    maintainAspectRatio: true,
    respectUserPositions: false,
    animationDuration: 600,
  },
  dense: {
    algorithm: 'pack',
    spacing: 2,
    maintainAspectRatio: false,
    respectUserPositions: false,
    animationDuration: 300,
  },
  flow: {
    algorithm: 'flow',
    spacing: 6,
    maintainAspectRatio: true,
    respectUserPositions: true,
    animationDuration: 500,
  },
};

/**
 * Calculate magnetic snap zones for a given grid layout
 */
export function calculateSnapZones(
  gridCols: number,
  containerWidth: number,
  existingComponents: ComponentBounds[]
): SnapZone[] {
  const zones: SnapZone[] = [];
  const colWidth = containerWidth / gridCols;

  // Grid line snap zones
  for (let i = 0; i <= gridCols; i++) {
    const x = i * colWidth;
    zones.push({
      type: 'grid',
      position: { x, y: 0 },
      strength: MAGNETIC_ZONES.GRID_LINES / SNAP_THRESHOLD,
      direction: 'vertical',
    });
  }

  // Component edge snap zones
  existingComponents.forEach((component) => {
    // Left edge
    zones.push({
      type: 'component_edge',
      position: { x: component.x * colWidth, y: component.y },
      strength: MAGNETIC_ZONES.COMPONENT_EDGES / SNAP_THRESHOLD,
      direction: 'vertical',
    });

    // Right edge
    zones.push({
      type: 'component_edge',
      position: { x: (component.x + component.w) * colWidth, y: component.y },
      strength: MAGNETIC_ZONES.COMPONENT_EDGES / SNAP_THRESHOLD,
      direction: 'vertical',
    });

    // Top edge
    zones.push({
      type: 'component_edge',
      position: { x: component.x * colWidth, y: component.y },
      strength: MAGNETIC_ZONES.COMPONENT_EDGES / SNAP_THRESHOLD,
      direction: 'horizontal',
    });

    // Bottom edge
    zones.push({
      type: 'component_edge',
      position: { x: component.x * colWidth, y: component.y + component.h },
      strength: MAGNETIC_ZONES.COMPONENT_EDGES / SNAP_THRESHOLD,
      direction: 'horizontal',
    });
  });

  // Center line snap zones
  zones.push({
    type: 'center_line',
    position: { x: containerWidth / 2, y: 0 },
    strength: MAGNETIC_ZONES.CENTER_LINES / SNAP_THRESHOLD,
    direction: 'vertical',
  });

  return zones;
}

/**
 * Apply magnetic snapping to a position
 */
export function applyMagneticSnapping(
  position: Position,
  size: Size,
  snapZones: SnapZone[],
  colWidth: number
): Position {
  let snappedX = position.x;
  let snappedY = position.y;

  snapZones.forEach((zone) => {
    const distance = Math.abs(
      zone.direction === 'vertical'
        ? position.x - zone.position.x / colWidth
        : position.y - zone.position.y
    );

    if (distance <= SNAP_THRESHOLD) {
      const snapStrength = Math.max(0, 1 - distance / SNAP_THRESHOLD) * zone.strength;

      if (zone.direction === 'vertical' && snapStrength > 0.5) {
        snappedX = zone.position.x / colWidth;
      } else if (zone.direction === 'horizontal' && snapStrength > 0.5) {
        snappedY = zone.position.y;
      }
    }
  });

  return { x: snappedX, y: snappedY };
}

/**
 * Pack algorithm - arrange components with minimal gaps
 */
export function packLayout(
  components: ComponentBounds[],
  gridCols: number,
  spacing: number = 4
): ComponentBounds[] {
  const sorted = [...components].sort((a, b) => {
    // Sort by size (larger first), then by current position
    const areaA = a.w * a.h;
    const areaB = b.w * b.h;
    if (areaA !== areaB) return areaB - areaA;
    return a.y - b.y || a.x - b.x;
  });

  const result: ComponentBounds[] = [];
  const occupiedGrid: boolean[][] = [];

  // Initialize grid
  const maxHeight = Math.max(...components.map((c) => c.y + c.h)) + 10;
  for (let y = 0; y < maxHeight; y++) {
    occupiedGrid[y] = new Array(gridCols).fill(false);
  }

  sorted.forEach((component) => {
    const { w, h } = component;
    let placed = false;

    // Try to place component starting from top-left
    for (let y = 0; y < maxHeight - h && !placed; y++) {
      for (let x = 0; x <= gridCols - w && !placed; x++) {
        // Check if position is free
        let canPlace = true;
        for (let dy = 0; dy < h && canPlace; dy++) {
          for (let dx = 0; dx < w && canPlace; dx++) {
            if (occupiedGrid[y + dy] && occupiedGrid[y + dy][x + dx]) {
              canPlace = false;
            }
          }
        }

        if (canPlace) {
          // Mark grid as occupied
          for (let dy = 0; dy < h; dy++) {
            for (let dx = 0; dx < w; dx++) {
              if (!occupiedGrid[y + dy]) occupiedGrid[y + dy] = new Array(gridCols).fill(false);
              occupiedGrid[y + dy][x + dx] = true;
            }
          }

          result.push({ ...component, x, y });
          placed = true;
        }
      }
    }

    // If couldn't place, put at bottom
    if (!placed) {
      const y = occupiedGrid.length;
      result.push({ ...component, x: 0, y });
    }
  });

  return result;
}

/**
 * Flow algorithm - arrange components in reading order
 */
export function flowLayout(
  components: ComponentBounds[],
  gridCols: number,
  spacingPx: number = 6
): ComponentBounds[] {
  const sorted = [...components].sort((a, b) => a.y - b.y || a.x - b.x);
  const result: ComponentBounds[] = [];

  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;
  const spacing = spacingPx / 30; // Convert pixels to grid units

  sorted.forEach((component) => {
    const { w, h } = component;

    // Check if component fits in current row
    if (currentX + w > gridCols) {
      // Move to next row
      currentX = 0;
      currentY += rowHeight + spacing;
      rowHeight = 0;
    }

    result.push({
      ...component,
      x: currentX,
      y: Math.floor(currentY),
    });

    currentX += w + spacing;
    rowHeight = Math.max(rowHeight, h);
  });

  return result;
}

/**
 * Distribute algorithm - evenly space components
 */
export function distributeLayout(
  components: ComponentBounds[],
  gridCols: number,
  spacingPx: number = 8
): ComponentBounds[] {
  if (components.length === 0) return [];

  const sorted = [...components].sort((a, b) => a.y - b.y || a.x - b.x);
  const result: ComponentBounds[] = [];

  // Calculate available space
  const totalWidth = components.reduce((sum, c) => sum + c.w, 0);
  const availableSpace = gridCols - totalWidth;
  const gaps = Math.max(1, components.length - 1);
  const gapSize = availableSpace / gaps;

  let currentX = 0;
  sorted.forEach((component) => {
    result.push({
      ...component,
      x: Math.floor(currentX),
      y: component.y,
    });

    currentX += component.w + gapSize;
  });

  return result;
}

/**
 * Auto-arrange components using specified algorithm
 */
export function autoArrangeComponents(
  components: ComponentBounds[],
  gridCols: number,
  options: AutoArrangeOptions
): ComponentBounds[] {
  switch (options.algorithm) {
    case 'pack':
      return packLayout(components, gridCols, options.spacing);
    case 'flow':
      return flowLayout(components, gridCols, options.spacing);
    case 'distribute':
      return distributeLayout(components, gridCols, options.spacing);
    default:
      return components;
  }
}

/**
 * Create smooth transition styles for component movement
 */
export function createTransitionStyles(
  config: AnimationConfig,
  delay: number = 0
): React.CSSProperties {
  return {
    transition: `all ${config.duration}ms ${config.easing}${delay ? ` ${delay}ms` : ''}`,
    willChange: 'transform, width, height',
  };
}

/**
 * Calculate if position would cause collision
 */
export function wouldCollide(
  newBounds: ComponentBounds,
  existingComponents: ComponentBounds[],
  excludeId?: string
): boolean {
  return existingComponents.some((existing) => {
    if (excludeId && existing.x === newBounds.x && existing.y === newBounds.y) {
      return false; // Skip same component
    }

    return !(
      newBounds.x >= existing.x + existing.w ||
      newBounds.x + newBounds.w <= existing.x ||
      newBounds.y >= existing.y + existing.h ||
      newBounds.y + newBounds.h <= existing.y
    );
  });
}

/**
 * Find optimal position with collision avoidance
 */
export function findOptimalPosition(
  size: Size,
  gridCols: number,
  existingComponents: ComponentBounds[],
  preferredPosition?: Position
): Position {
  const { w, h } = size;

  // Try preferred position first
  if (preferredPosition) {
    const bounds = { ...preferredPosition, ...size };
    if (!wouldCollide(bounds, existingComponents)) {
      return preferredPosition;
    }
  }

  // Search for best position
  const maxY = Math.max(...existingComponents.map((c) => c.y + c.h), 0) + 5;

  for (let y = 0; y <= maxY; y++) {
    for (let x = 0; x <= gridCols - w; x++) {
      const bounds = { x, y, w, h };
      if (!wouldCollide(bounds, existingComponents)) {
        return { x, y };
      }
    }
  }

  // Fallback: place at bottom
  return { x: 0, y: maxY + 1 };
}

/**
 * Calculate distance between two component bounds
 */
export function calculateComponentDistance(
  bounds1: ComponentBounds,
  bounds2: ComponentBounds
): number {
  const center1 = {
    x: bounds1.x + bounds1.w / 2,
    y: bounds1.y + bounds1.h / 2,
  };
  const center2 = {
    x: bounds2.x + bounds2.w / 2,
    y: bounds2.y + bounds2.h / 2,
  };

  return Math.sqrt(Math.pow(center2.x - center1.x, 2) + Math.pow(center2.y - center1.y, 2));
}

/**
 * Calculate overlap between two component bounds
 */
export function calculateOverlap(
  bounds1: ComponentBounds,
  bounds2: ComponentBounds
): { horizontal: number; vertical: number; area: number } {
  const horizontalOverlap = Math.max(
    0,
    Math.min(bounds1.x + bounds1.w, bounds2.x + bounds2.w) - Math.max(bounds1.x, bounds2.x)
  );

  const verticalOverlap = Math.max(
    0,
    Math.min(bounds1.y + bounds1.h, bounds2.y + bounds2.h) - Math.max(bounds1.y, bounds2.y)
  );

  return {
    horizontal: horizontalOverlap,
    vertical: verticalOverlap,
    area: horizontalOverlap * verticalOverlap,
  };
}

/**
 * Calculate optimal push direction for minimal disruption
 */
export function calculateOptimalPushDirection(
  draggedBounds: ComponentBounds,
  targetBounds: ComponentBounds,
  allComponents: ComponentBounds[],
  gridCols: number,
  config: SpaceMakingConfig = DEFAULT_SPACE_MAKING_CONFIG
): PushDirection {
  const draggedCenter = {
    x: draggedBounds.x + draggedBounds.w / 2,
    y: draggedBounds.y + draggedBounds.h / 2,
  };

  const targetCenter = {
    x: targetBounds.x + targetBounds.w / 2,
    y: targetBounds.y + targetBounds.h / 2,
  };

  // Calculate direction vector from dragged to target
  const deltaX = targetCenter.x - draggedCenter.x;
  const deltaY = targetCenter.y - draggedCenter.y;

  // Possible push directions
  const directions = [
    { x: 1, y: 0, name: 'right' }, // Push right
    { x: -1, y: 0, name: 'left' }, // Push left
    { x: 0, y: 1, name: 'down' }, // Push down
    { x: 0, y: -1, name: 'up' }, // Push up
  ];

  let bestDirection = directions[0];
  let bestScore = -1;

  directions.forEach((direction) => {
    // Calculate new position if pushed in this direction
    const newX = targetBounds.x + direction.x * config.pushForce;
    const newY = targetBounds.y + direction.y * config.pushForce;

    // Check if new position is valid
    if (newX < 0 || newX + targetBounds.w > gridCols || newY < 0) {
      return; // Invalid position
    }

    const newBounds = { ...targetBounds, x: newX, y: newY };

    // Calculate score for this direction
    let score = 100; // Start with high score

    // Penalty for moving against natural direction
    if (direction.x !== 0 && Math.sign(direction.x) !== Math.sign(deltaX)) {
      score -= 30;
    }
    if (direction.y !== 0 && Math.sign(direction.y) !== Math.sign(deltaY)) {
      score -= 30;
    }

    // Penalty for creating new collisions
    allComponents.forEach((component) => {
      if (component.x === targetBounds.x && component.y === targetBounds.y) return;
      if (wouldCollide(newBounds, [component])) {
        score -= 40;
      }
    });

    // Bonus for moving in primary direction
    if (Math.abs(deltaX) > Math.abs(deltaY) && direction.y === 0) {
      score += 20;
    } else if (Math.abs(deltaY) > Math.abs(deltaX) && direction.x === 0) {
      score += 20;
    }

    // Penalty for moving to grid edges
    if (newX === 0 || newX + targetBounds.w === gridCols) {
      score -= 10;
    }

    if (score > bestScore) {
      bestScore = score;
      bestDirection = direction;
    }
  });

  return {
    x: bestDirection.x,
    y: bestDirection.y,
    distance: config.pushForce,
    priority: Math.max(0, bestScore / 100),
  };
}

/**
 * Detect components that need space-making
 */
export function detectSpaceMakingNeeds(
  draggedBounds: ComponentBounds,
  allComponents: ComponentBounds[],
  gridCols: number,
  config: SpaceMakingConfig = DEFAULT_SPACE_MAKING_CONFIG
): AffectedComponent[] {
  if (!config.enabled) return [];

  const affected: AffectedComponent[] = [];
  let animationDelay = 0;

  allComponents.forEach((component) => {
    // Skip self
    if (component.x === draggedBounds.x && component.y === draggedBounds.y) {
      return;
    }

    const distance = calculateComponentDistance(draggedBounds, component);
    const overlap = calculateOverlap(draggedBounds, component);

    // Determine if component needs to be moved
    let shouldMove = false;
    let pushDistance = 0;

    if (overlap.area > 0) {
      // Direct collision - immediate move
      shouldMove = true;
      pushDistance = config.pushForce;
    } else if (distance <= config.anticipationRadius) {
      // Within anticipation zone - prepare to move
      shouldMove = true;
      pushDistance = Math.max(1, config.pushForce * (1 - distance / config.anticipationRadius));
    }

    if (shouldMove) {
      const pushDirection = calculateOptimalPushDirection(
        draggedBounds,
        component,
        allComponents,
        gridCols,
        config
      );

      const targetPosition = {
        x: component.x + pushDirection.x * pushDistance,
        y: component.y + pushDirection.y * pushDistance,
      };

      // Ensure target position is valid
      if (
        targetPosition.x >= 0 &&
        targetPosition.x + component.w <= gridCols &&
        targetPosition.y >= 0
      ) {
        affected.push({
          componentId: `${component.x}-${component.y}`, // Temporary ID
          originalPosition: { x: component.x, y: component.y },
          targetPosition,
          pushDirection: {
            ...pushDirection,
            distance: pushDistance,
          },
          animationDelay,
        });

        animationDelay += config.animationStagger;
      }
    }
  });

  return affected;
}

/**
 * Apply space-making to layout
 */
export function applySpaceMaking(
  draggedBounds: ComponentBounds,
  layout: ComponentBounds[],
  gridCols: number,
  config: SpaceMakingConfig = DEFAULT_SPACE_MAKING_CONFIG
): ComponentBounds[] {
  if (!config.enabled) return layout;

  const affected = detectSpaceMakingNeeds(draggedBounds, layout, gridCols, config);

  if (affected.length === 0) return layout;

  const result = [...layout];

  // Apply movements
  affected.forEach((affectedComponent) => {
    const componentIndex = result.findIndex(
      (component) =>
        component.x === affectedComponent.originalPosition.x &&
        component.y === affectedComponent.originalPosition.y
    );

    if (componentIndex !== -1) {
      result[componentIndex] = {
        ...result[componentIndex],
        x: affectedComponent.targetPosition.x,
        y: affectedComponent.targetPosition.y,
      };
    }
  });

  // Handle cascading if enabled
  if (config.cascadeDepth > 0) {
    // TODO: Implement cascading push logic
    // For now, return simple result
  }

  return result;
}

/**
 * Calculate space-making layout with cascade handling
 */
export function calculateSpaceMakingLayout(
  draggedItem: ComponentBounds,
  layout: ComponentBounds[],
  gridCols: number,
  config: SpaceMakingConfig = DEFAULT_SPACE_MAKING_CONFIG
): ComponentBounds[] {
  let currentLayout = [...layout];
  let depth = 0;

  while (depth < config.cascadeDepth) {
    const newLayout = applySpaceMaking(draggedItem, currentLayout, gridCols, config);

    // Check if any changes were made
    const hasChanges = newLayout.some(
      (component, index) =>
        component.x !== currentLayout[index].x || component.y !== currentLayout[index].y
    );

    if (!hasChanges) {
      break; // No more changes needed
    }

    currentLayout = newLayout;
    depth++;
  }

  return currentLayout;
}
