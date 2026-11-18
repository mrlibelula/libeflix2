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
/** Same as desktop `bottom-14` — docks menus just above the transport row / tracker */
const DEFAULT_ANCHOR_GAP = 56;
const TRACKER_GAP = 4;
const MENU_WIDTH = 240;
const MENU_MIN_WIDTH = 180;
const MENU_MIN_HEIGHT = 120;
const MENU_MAX_HEIGHT = 420;
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
 * Distance from the player bottom to just above the progress tracker.
 * Matches desktop menus that sit flush over the scrubber instead of clearing the whole chrome.
 */
function measureTrackerAnchorGap(anchor: HTMLElement | null | undefined, fallback: number): number {
  if (!anchor) return fallback;

  const tracker = anchor.querySelector<HTMLElement>('[data-player-progress]');
  if (!tracker) return fallback;

  const anchorRect = anchor.getBoundingClientRect();
  const trackerRect = tracker.getBoundingClientRect();
  if (trackerRect.height <= 0) return fallback;

  // Dock just above the scrubber (desktop uses bottom-14 for the same feel).
  const gap = Math.round(anchorRect.bottom - trackerRect.top + TRACKER_GAP);
  return Math.max(fallback, gap);
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

      const anchorGap = measureTrackerAnchorGap(anchor, DEFAULT_ANCHOR_GAP);

      // Intersection of the player box and the visual viewport — menus must stay inside this.
      const safeTop = Math.max(
        viewportOffsetTop + VIEWPORT_PAD,
        (anchorRect?.top ?? viewportOffsetTop) + VIEWPORT_PAD
      );
      const safeBottom = Math.min(
        viewportOffsetTop + viewportHeight - VIEWPORT_PAD,
        (anchorRect?.bottom ?? viewportOffsetTop + viewportHeight) - VIEWPORT_PAD
      );
      const safeHeight = Math.max(MENU_MIN_HEIGHT, safeBottom - safeTop);

      const boxWidth = anchorRect?.width ?? viewportWidth;
      const width = Math.min(MENU_WIDTH, Math.max(MENU_MIN_WIDTH, boxWidth - EDGE_INSET * 2));

      let bottom: number;
      let right: number;
      let left: number;
      let menuBottomY: number;

      if (positionedInsideAnchor && anchorRect) {
        // absolute coords relative to the player / fullscreen root
        bottom = Math.min(anchorGap, Math.max(VIEWPORT_PAD, anchorRect.height - MENU_MIN_HEIGHT));
        right = EDGE_INSET;
        left = Math.max(EDGE_INSET, boxWidth - width - EDGE_INSET);
        menuBottomY = anchorRect.bottom - bottom;
      } else {
        // fixed coords relative to the visual viewport (body fallback)
        menuBottomY = Math.min(
          safeBottom,
          anchorRect ? anchorRect.bottom - anchorGap : safeBottom
        );
        bottom = Math.max(VIEWPORT_PAD, window.innerHeight - menuBottomY);
        const viewportRight = viewportOffsetLeft + viewportWidth;
        right = Math.max(VIEWPORT_PAD, window.innerWidth - viewportRight + EDGE_INSET);
        left = Math.max(
          VIEWPORT_PAD + viewportOffsetLeft,
          viewportRight - width - EDGE_INSET
        );
      }

      // Fit entirely between the safe top and the menu bottom — prevents overflow:hidden
      // ancestors (party wrappers, dialog shells) from clipping options off-screen.
      const maxHeight = Math.min(
        MENU_MAX_HEIGHT,
        safeHeight,
        Math.max(MENU_MIN_HEIGHT, menuBottomY - safeTop)
      );

      const menuRect = menu?.getBoundingClientRect();
      const spaceBelowMenu = menuRect
        ? Math.min(safeBottom, viewportOffsetTop + viewportHeight) - menuRect.top - VIEWPORT_PAD
        : maxHeight;
      const spaceAboveMenu = menuRect
        ? menuRect.bottom - safeTop
        : maxHeight;
      const openSubmenuUpward = spaceBelowMenu < 200;
      const submenuMaxHeight = Math.max(
        140,
        Math.min(350, openSubmenuUpward ? spaceAboveMenu : spaceBelowMenu, maxHeight)
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
