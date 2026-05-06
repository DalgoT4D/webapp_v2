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

/**
 * Calculate magnetic snap zones for a given grid layout
 * Always uses 12 columns for grid snap zones (Superset-style)
 */
export function calculateSnapZones(
  _gridCols: number,
  containerWidth: number,
  existingComponents: ComponentBounds[]
): SnapZone[] {
  const zones: SnapZone[] = [];
  // Always use 12 columns for snap zones (Superset-style responsive grid)
  const FIXED_COLS = 12;
  const colWidth = containerWidth / FIXED_COLS;

  // Grid line snap zones - always 12 columns that scale with container width
  for (let i = 0; i <= FIXED_COLS; i++) {
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
 * Type for any item that participates in fluid row flow.
 * Generic so callers can pass richer objects (e.g. RGL Layout items with i/static/etc).
 */
export type FluidFlowItem = {
  i?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  maxW?: number;
  minH?: number;
  maxH?: number;
};

/**
 * Flow algorithm — arrange items left-to-right, wrap to next row when full.
 *
 * Contract:
 *   - Array order is the source of truth for sequence (input order preserved in output).
 *   - (x, y) is recomputed; w and h are clamped to constraints.
 *   - `gridCols` is the absolute ceiling on `w`; a `maxW` larger than `gridCols` is silently clamped to `gridCols`.
 *   - When `minW > maxW` (caller passed inconsistent constraints), `minW` wins.
 *   - Row height = tallest item in that row. Next row starts at cumulative_y + max_h.
 *   - All non-positional fields are passed through unchanged.
 *
 * Pure function: does not mutate input.
 */
export function flowLayout<T extends FluidFlowItem>(items: T[], gridCols: number): T[] {
  const result: T[] = [];
  let currentX = 0;
  let currentY = 0;
  let rowHeight = 0;

  for (const original of items) {
    const minW = original.minW ?? 1;
    const maxW = original.maxW ?? gridCols;
    const minH = original.minH ?? 1;
    const maxH = original.maxH ?? Number.POSITIVE_INFINITY;

    // gridCols is the absolute ceiling; minW/maxW operate within it. minW wins on conflict.
    const w = Math.min(gridCols, Math.max(minW, Math.min(maxW, original.w)));
    const h = Math.max(minH, Math.min(maxH, original.h));

    if (currentX + w > gridCols) {
      currentY += rowHeight;
      currentX = 0;
      rowHeight = 0;
    }

    result.push({ ...original, x: currentX, y: currentY, w, h });

    currentX += w;
    rowHeight = Math.max(rowHeight, h);
  }

  return result;
}

/**
 * Run a mutation against a layout array, then reflow.
 * Use this for every state change to keep storage and rendering in sync.
 *
 * @example
 *   setLayout(applyMutation(layout, (l) => l.filter((i) => i.i !== id), 12));
 */
export function applyMutation<T extends FluidFlowItem>(
  layout: T[],
  mutate: (l: T[]) => T[],
  gridCols: number
): T[] {
  return flowLayout(mutate(layout), gridCols);
}

/**
 * Given the *current flowed layout* and a newly-positioned item (from RGL drag),
 * compute the linear index at which the dragged item should be inserted.
 *
 * Strategy: compare the dragged item's *center* to each existing item's row band
 * and horizontal center. Insert before the first item that is "after" the cursor
 * in reading order (top-to-bottom, left-to-right).
 *
 * "After the cursor" means:
 *   - Item is in a strictly later row (its top is below the dragged item's center), OR
 *   - Item is in the same row band AND its center is to the right of the dragged center.
 */
export function computeInsertionIndex<T extends FluidFlowItem>(
  layout: T[],
  draggedItem: { i: string; x: number; y: number; w: number; h: number },
  _gridCols: number
): number {
  const others = layout.filter((it) => it.i !== draggedItem.i);
  if (others.length === 0) return 0;

  const dCenterX = draggedItem.x + draggedItem.w / 2;
  const dCenterY = draggedItem.y + draggedItem.h / 2;

  for (let idx = 0; idx < others.length; idx++) {
    const o = others[idx];
    const oRowTop = o.y;
    const oRowBottom = o.y + o.h;
    const oCenterX = o.x + o.w / 2;

    // Cursor is clearly above this item's row → insert before it
    if (dCenterY < oRowTop) return idx;

    // Cursor is in this item's row band (vertically overlaps) → compare horizontally
    if (dCenterY < oRowBottom) {
      if (dCenterX < oCenterX) return idx;
    }
    // Otherwise the cursor is below this item's row → keep walking
  }
  return others.length;
}

/**
 * Reorder: remove item with given id from layout, insert at targetIndex (in the
 * post-removal array). targetIndex of `layout.length - 1` appends at end.
 */
export function moveItemToIndex<T extends FluidFlowItem>(
  layout: T[],
  id: string,
  targetIndex: number
): T[] {
  const item = layout.find((it) => it.i === id);
  if (!item) return layout;
  const without = layout.filter((it) => it.i !== id);
  const clamped = Math.max(0, Math.min(targetIndex, without.length));
  return [...without.slice(0, clamped), item, ...without.slice(clamped)];
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
