import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';

export type ViewportMenuPosition = {
  /** Distance from containing block bottom to the menu bottom edge */
  bottom: number;
  left: number;
  right: number;
  /** Content-fitting width (not full player / viewport bleed) */
  width: number;
  maxHeight: number;
  submenuMaxHeight: number;
  openSubmenuUpward: boolean;
};

const VIEWPORT_PAD = 8;
const DEFAULT_ANCHOR_GAP = 56;
const MENU_WIDTH = 240;
const MENU_MIN_WIDTH = 180;
const EDGE_INSET = 16;

function getFullscreenElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const doc = document as Document & {
    webkitFullscreenElement?: Element | null;
    mozFullScreenElement?: Element | null;
  };
  return (
    (document.fullscreenElement as HTMLElement | null) ||
    (doc.webkitFullscreenElement as HTMLElement | null) ||
    (doc.mozFullScreenElement as HTMLElement | null)
  );
}

/**
 * Native fullscreen only paints descendants of the fullscreen element.
 * Prefer the player root (or the fullscreen node that contains it) over document.body.
 */
export function resolvePlayerMenuPortalTarget(
  anchor: HTMLElement | null | undefined
): HTMLElement | null {
  if (typeof document === 'undefined') return null;

  const fs = getFullscreenElement();
  if (fs && (!anchor || fs === anchor || fs.contains(anchor))) {
    return fs;
  }

  return anchor ?? document.body;
}

/** Resolve (and keep fresh) the DOM node menus should portal into. */
export function usePlayerMenuPortalTarget(
  anchorRef?: RefObject<HTMLElement | null>,
  enabled = true
): HTMLElement | null {
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);

  useLayoutEffect(() => {
    if (!enabled) {
      setPortalTarget(null);
      return;
    }

    const sync = () => {
      setPortalTarget(resolvePlayerMenuPortalTarget(anchorRef?.current ?? null));
    };

    sync();
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
    window.addEventListener('resize', sync);
    return () => {
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('webkitfullscreenchange', sync);
      window.removeEventListener('resize', sync);
    };
  }, [anchorRef, enabled]);

  return portalTarget;
}

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
 * Keeps player context menus fully inside the visual viewport / player box.
 * Menus are width-fit and right-aligned above the controls — not full-bleed sheets.
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
    right: EDGE_INSET,
    width: MENU_WIDTH,
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
      const menuParent = menu?.offsetParent as HTMLElement | null;
      const positionedInsideAnchor =
        !!anchor &&
        !!menu &&
        (anchor === menu.parentElement ||
          (anchor.contains(menu) &&
            (menuParent === anchor || (!!menuParent && anchor.contains(menuParent)))));

      // Sit just above the player / controls bottom edge.
      const anchorBottomY = anchorRect
        ? Math.min(anchorRect.bottom - 12, viewportOffsetTop + viewportHeight - VIEWPORT_PAD)
        : viewportOffsetTop + viewportHeight - DEFAULT_ANCHOR_GAP;

      const availableAbove = Math.max(160, anchorBottomY - viewportOffsetTop - VIEWPORT_PAD);
      const maxHeight = Math.min(420, availableAbove);

      const boxWidth = anchorRect?.width ?? viewportWidth;
      const width = Math.min(MENU_WIDTH, Math.max(MENU_MIN_WIDTH, boxWidth - EDGE_INSET * 2));

      let bottom: number;
      let right: number;
      let left: number;

      if (positionedInsideAnchor && anchorRect) {
        // absolute coords relative to the player / fullscreen root
        bottom = DEFAULT_ANCHOR_GAP;
        right = EDGE_INSET;
        left = Math.max(EDGE_INSET, boxWidth - width - EDGE_INSET);
      } else {
        // fixed coords relative to the visual viewport (body fallback)
        bottom = Math.max(VIEWPORT_PAD, viewportOffsetTop + viewportHeight - anchorBottomY);
        const viewportRight = viewportOffsetLeft + viewportWidth;
        right = Math.max(VIEWPORT_PAD, window.innerWidth - viewportRight + EDGE_INSET);
        left = Math.max(
          VIEWPORT_PAD + viewportOffsetLeft,
          viewportRight - width - EDGE_INSET
        );
      }

      const menuRect = menu?.getBoundingClientRect();
      const spaceBelowMenu = menuRect
        ? viewportOffsetTop + viewportHeight - menuRect.top - VIEWPORT_PAD
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
        width,
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
    document.addEventListener('fullscreenchange', update);
    document.addEventListener('webkitfullscreenchange', update);
    viewport?.addEventListener('resize', update);
    viewport?.addEventListener('scroll', update);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
      document.removeEventListener('fullscreenchange', update);
      document.removeEventListener('webkitfullscreenchange', update);
      viewport?.removeEventListener('resize', update);
      viewport?.removeEventListener('scroll', update);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- callers pass explicit deps
  }, [enabled, menuRef, anchorRef, ...deps]);

  return position;
}
