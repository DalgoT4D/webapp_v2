'use client';

import { toast } from 'sonner';
import type { WidgetDrillToast } from './logic/chart-widget-map';

/** Shows a region click's toasts in order, through sonner as the widgets always did. */
export function showWidgetDrillToasts(toasts: WidgetDrillToast[]) {
  toasts.forEach(({ variant, message }) => toast[variant](message));
}
