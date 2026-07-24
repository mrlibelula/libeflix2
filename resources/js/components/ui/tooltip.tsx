import React, { useState, useRef, useEffect } from 'react';
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
  const isTouchRef = useRef(false);

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

  // Suppress tooltip on touch devices: a tap fires touchstart before the
  // synthesized mouseenter, so we set a flag and skip showing.
  const handleTouchStart = () => {
    isTouchRef.current = true;
    // Dismiss any visible tooltip immediately on touch
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  };

  // Handle mouse events
  const handleMouseEnter = () => {
    // Skip tooltip when the mouseenter was synthesized from a touch
    if (isTouchRef.current) {
      isTouchRef.current = false;
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (onlyWhenTruncated && triggerRef.current && !isTruncatedWithin(triggerRef.current)) {
        return;
      }

      setIsVisible(true);
      // Reset position to initial prop value when showing
      setActualPosition(position);
      // Update position immediately and then after a small delay for tooltip rendering
      updatePosition();
      requestAnimationFrame(() => {
        updatePosition();
      });
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsVisible(false);
    isTouchRef.current = false;
  };

  // Update position when window resizes or scrolls
  useEffect(() => {
    if (isVisible) {
      // Initial position update
      updatePosition();
      
      // Create throttled update function for better performance
      let timeoutId: NodeJS.Timeout;
      const throttledUpdate = () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(updatePosition, 16); // ~60fps
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
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
        onTouchStart={handleTouchStart}
      >
        {children}
      </div>
      
      {(text || content) && isVisible && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed px-2 py-1 rounded text-xs shadow-sm ${variantClasses[variant]} ${getAnimationClass()} z-[9999] ${className} ${content ? 'whitespace-normal' : 'whitespace-nowrap'} max-w-xs`}
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
