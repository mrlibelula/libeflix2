import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipVariant = 'dark' | 'light';

interface TooltipProps {
  children: React.ReactNode;
  text?: string;
  content?: React.ReactNode;
  delayMs?: number;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  className?: string;
  triggerClassName?: string;
  /** Only show the tooltip when truncated text (`.truncate` or the trigger) overflows. */
  onlyWhenTruncated?: boolean;
  offset?: number;
}

function isTruncatedWithin(root: HTMLElement): boolean {
  const candidates = [
    root,
    ...Array.from(root.querySelectorAll<HTMLElement>('.truncate')),
  ];

  return candidates.some((el) => el.scrollWidth > el.clientWidth + 1);
}

function isKeyboardFocus(event: React.FocusEvent): boolean {
  // Prefer :focus-visible when supported; fall back to excluding touch/mouse opens.
  const target = event.currentTarget as HTMLElement;
  try {
    return target.matches(':focus-visible');
  } catch {
    return false;
  }
}

// Our custom tooltip component
export function Tooltip({ 
  children, 
  text, 
  content,
  delayMs = 700, 
  position = 'top',
  variant = 'dark',
  className = '',
  triggerClassName,
  onlyWhenTruncated = false,
  offset = 8
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const suppressShowRef = useRef(false);

  const hide = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Variant classes for styling
  const variantClasses = {
    dark: "bg-black text-white",
    light: "bg-white text-black border border-gray-200 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
  };

  // Calculate position based on trigger element
  const updatePosition = () => {
    if (!triggerRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    
    // Get initial tooltip dimensions by temporarily rendering it off-screen
    let tooltipWidth = 200; // fallback width
    let tooltipHeight = 32; // fallback height
    
    if (tooltipRef.current) {
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      tooltipWidth = tooltipRect.width || tooltipWidth;
      tooltipHeight = tooltipRect.height || tooltipHeight;
    }
    
    let top = 0;
    let left = 0;
    let newPosition = position;
    
    // Check if we need to flip the position due to viewport constraints
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    switch(position) {
      case 'top':
        // If tooltip would go above viewport, flip to bottom
        if (triggerRect.top - tooltipHeight - offset < 0) {
          newPosition = 'bottom';
          top = triggerRect.bottom + offset;
        } else {
          top = triggerRect.top - tooltipHeight - offset;
        }
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'bottom':
        // If tooltip would go below viewport, flip to top
        if (triggerRect.bottom + tooltipHeight + offset > viewportHeight) {
          newPosition = 'top';
          top = triggerRect.top - tooltipHeight - offset;
        } else {
          top = triggerRect.bottom + offset;
        }
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipWidth / 2);
        break;
      case 'left':
        // If tooltip would go beyond left viewport, flip to right
        if (triggerRect.left - tooltipWidth - offset < 0) {
          newPosition = 'right';
          left = triggerRect.right + offset;
        } else {
          left = triggerRect.left - tooltipWidth - offset;
        }
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2);
        break;
      case 'right':
        // If tooltip would go beyond right viewport, flip to left
        if (triggerRect.right + tooltipWidth + offset > viewportWidth) {
          newPosition = 'left';
          left = triggerRect.left - tooltipWidth - offset;
        } else {
          left = triggerRect.right + offset;
        }
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipHeight / 2);
        break;
    }
    
    // Prevent tooltip from going off-screen horizontally
    if (left < 10) {
      left = 10;
    } else if (left + tooltipWidth > viewportWidth - 10) {
      left = viewportWidth - tooltipWidth - 10;
    }
    
    // Prevent tooltip from going off-screen vertically
    if (top < 10) {
      top = 10;
    } else if (top + tooltipHeight > viewportHeight - 10) {
      top = viewportHeight - tooltipHeight - 10;
    }
    
    setTooltipPosition({ top, left });
    setActualPosition(newPosition);
  };

  const scheduleShow = () => {
    if (suppressShowRef.current) return;

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (suppressShowRef.current) return;
      if (onlyWhenTruncated && triggerRef.current && !isTruncatedWithin(triggerRef.current)) {
        return;
      }

      setIsVisible(true);
      setActualPosition(position);
      updatePosition();
      requestAnimationFrame(() => {
        updatePosition();
      });
    }, delayMs);
  };

  // Pointer/touch interaction should never leave a sticky tooltip behind.
  const handlePointerDown = () => {
    suppressShowRef.current = true;
    hide();
  };

  const handlePointerUp = () => {
    // Keep suppression briefly so synthesized mouseenter/focus after tap can't reopen it.
    window.setTimeout(() => {
      suppressShowRef.current = false;
    }, 400);
  };

  const handleMouseEnter = () => {
    if (suppressShowRef.current) return;
    // Touch / coarse pointers don't get hover tooltips.
    if (window.matchMedia('(hover: none)').matches) return;
    scheduleShow();
  };

  const handleMouseLeave = () => {
    hide();
  };

  const handleFocus = (event: React.FocusEvent) => {
    if (suppressShowRef.current) return;
    // Only keyboard focus should open tooltips — click/tap focus must not.
    if (!isKeyboardFocus(event)) return;
    scheduleShow();
  };

  const handleBlur = () => {
    hide();
  };

  // While visible, dismiss if pointer leaves the trigger (covers cases where
  // mouseleave is skipped because controls become pointer-events-none).
  useEffect(() => {
    if (!isVisible) return;

    const onPointerMove = (event: PointerEvent) => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.top &&
        event.clientY <= rect.bottom;
      if (!inside) hide();
    };

    const onScrollOrTouch = () => hide();

    document.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('scroll', onScrollOrTouch, true);
    document.addEventListener('touchstart', onScrollOrTouch, { passive: true, capture: true });

    return () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('scroll', onScrollOrTouch, true);
      document.removeEventListener('touchstart', onScrollOrTouch, true);
    };
  }, [isVisible, hide]);

  // Update position when window resizes or scrolls
  useEffect(() => {
    if (isVisible) {
      updatePosition();
      
      let timeoutId: NodeJS.Timeout;
      const throttledUpdate = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updatePosition, 16);
      };
      
      window.addEventListener('resize', throttledUpdate);
      window.addEventListener('scroll', throttledUpdate, { passive: true });
      
      return () => {
        clearTimeout(timeoutId);
        window.removeEventListener('resize', throttledUpdate);
        window.removeEventListener('scroll', throttledUpdate);
      };
    }
  }, [isVisible, position]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Animation classes based on position
  const getAnimationClass = () => {
    switch(actualPosition) {
      case 'top': return 'animate-in fade-in-0 slide-in-from-bottom-1';
      case 'bottom': return 'animate-in fade-in-0 slide-in-from-top-1';
      case 'left': return 'animate-in fade-in-0 slide-in-from-right-1';
      case 'right': return 'animate-in fade-in-0 slide-in-from-left-1';
      default: return 'animate-in fade-in-0';
    }
  };

  return (
    <>
      <div 
        ref={triggerRef}
        className={cn('inline-flex', triggerClassName)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onClick={hide}
      >
        {children}
      </div>
      
      {(text || content) && isVisible && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed px-2 py-1 rounded text-xs shadow-sm ${variantClasses[variant]} ${getAnimationClass()} z-[9999] ${className} ${content ? 'whitespace-normal' : 'whitespace-nowrap'} max-w-xs pointer-events-none`}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {content || text}
        </div>,
        document.body
      )}
    </>
  );
}

// Backward compatibility with RadixUI Tooltip components
export const TooltipProvider: React.FC<React.PropsWithChildren<{ delayDuration?: number }>> = ({ children }) => {
  return <>{children}</>;
};

export const TooltipTrigger: React.FC<React.PropsWithChildren<{ asChild?: boolean }>> = ({ children }) => {
  return <>{children}</>;
};

export const TooltipContent: React.FC<React.PropsWithChildren<{ className?: string; sideOffset?: number }>> = ({ children, className }) => {
  return <div className={className}>{children}</div>;
};
