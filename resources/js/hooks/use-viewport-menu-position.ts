import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export type ViewportMenuPosition = {
  /** Distance from visual viewport bottom to the menu bottom edge */
  bottom: number;
  left: number;
  right: number;
  maxHeight: number;
  submenuMaxHeight: number;
  openSubmenuUpward: boolean;
};

const VIEWPORT_PAD = 8;
const DEFAULT_ANCHOR_GAP = 56;

/** Prefer the mobile sheet whenever the viewport is narrow, short, or touch-first. */
export function usePreferMobilePlayerMenu(isMobileFlag = false): boolean {
  const [preferMobile, setPreferMobile] = useState(isMobileFlag);

  useEffect(() => {
    const update = () => {
      const narrow = window.matchMedia('(max-width: 767px)').matches;
      const short = window.matchMedia('(max-height: 520px)').matches;
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      setPreferMobile(isMobileFlag || narrow || short || coarse);
    };

    update();
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, [isMobileFlag]);

  return preferMobile;
}

/**
 * Keeps player context menus fully inside the visual viewport.
 * Pass `anchorRef` (player root / controls) when the menu is portaled to document.body.
 */
export function useViewportMenuPosition(
  menuRef: RefObject<HTMLElement | null>,
  enabled: boolean,
  deps: unknown[] = [],
  anchorRef?: RefObject<HTMLElement | null>
): ViewportMenuPosition {
  const [position, setPosition] = useState<ViewportMenuPosition>({
    bottom: DEFAULT_ANCHOR_GAP,
    left: VIEWPORT_PAD,
    right: VIEWPORT_PAD,
    maxHeight: 360,
    submenuMaxHeight: 320,
    openSubmenuUpward: false,
  });

  useLayoutEffect(() => {
    if (!enabled) return;

    const update = () => {
      const menu = menuRef.current;
      const anchor =
        anchorRef?.current ??
        (menu?.closest('[data-player-root]') as HTMLElement | null) ??
        (menu?.closest('.pointer-events-auto') as HTMLElement | null);

      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
      const viewportOffsetTop = window.visualViewport?.offsetTop ?? 0;
      const viewportOffsetLeft = window.visualViewport?.offsetLeft ?? 0;

      const anchorRect = anchor?.getBoundingClientRect();

      // Sit just above the player / controls bottom edge.
      const anchorBottomY = anchorRect
        ? Math.min(anchorRect.bottom - 12, viewportOffsetTop + viewportHeight - VIEWPORT_PAD)
        : viewportOffsetTop + viewportHeight - DEFAULT_ANCHOR_GAP;

      const availableAbove = Math.max(160, anchorBottomY - viewportOffsetTop - VIEWPORT_PAD);
      const maxHeight = Math.min(420, availableAbove);

      const bottom = Math.max(VIEWPORT_PAD, (viewportOffsetTop + viewportHeight) - anchorBottomY);

      const left = VIEWPORT_PAD + viewportOffsetLeft;
      const right = Math.max(
        VIEWPORT_PAD,
        window.innerWidth - (viewportOffsetLeft + viewportWidth) + VIEWPORT_PAD
      );

      const menuRect = menu?.getBoundingClientRect();
      const spaceBelowMenu = menuRect
        ? (viewportOffsetTop + viewportHeight) - menuRect.top - VIEWPORT_PAD
        : maxHeight;
      const spaceAboveMenu = menuRect
        ? menuRect.bottom - viewportOffsetTop - VIEWPORT_PAD
        : maxHeight;
      const openSubmenuUpward = spaceBelowMenu < 200;
      const submenuMaxHeight = Math.max(
        140,
        Math.min(350, openSubmenuUpward ? spaceAboveMenu : spaceBelowMenu)
      );

      setPosition({
        bottom,
        left,
        right,
        maxHeight,
        submenuMaxHeight,
        openSubmenuUpward,
      });
    };

    update();
    const raf = requestAnimationFrame(update);

    const viewport = window.visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass explicit deps
  }, [enabled, menuRef, anchorRef, ...deps]);

  return position;
}
