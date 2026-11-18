import { useCallback, useRef, type TouchEvent } from 'react';

/** Movement beyond this (px) is treated as a scroll/drag, not a tap. */
export const MENU_TAP_MOVEMENT_THRESHOLD_PX = 18;

/**
 * Distinguishes taps from scroll gestures inside player context menus.
 * Mobile browsers still fire touchend after a drag; without this guard,
 * scrollable menus select the item the gesture started on.
 */
export function useMenuTouchTap(thresholdPx = MENU_TAP_MOVEMENT_THRESHOLD_PX) {
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const onMenuTouchStart = useCallback((e: TouchEvent) => {
    e.stopPropagation();
    const touch = e.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }, []);

  const onMenuTouchEnd = useCallback(
    (e: TouchEvent, action: () => void) => {
      e.stopPropagation();
      e.preventDefault();

      const touch = e.changedTouches[0];
      const start = touchStartRef.current;
      touchStartRef.current = null;

      if (!touch || !start) return;

      const deltaX = Math.abs(touch.clientX - start.x);
      const deltaY = Math.abs(touch.clientY - start.y);
      if (deltaX >= thresholdPx || deltaY >= thresholdPx) {
        return;
      }

      action();
    },
    [thresholdPx]
  );

  return { onMenuTouchStart, onMenuTouchEnd };
}
