import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';
type TooltipVariant = 'dark' | 'light';

interface TooltipProps {
  children: React.ReactNode;
  text?: string;
  delayMs?: number;
  position?: TooltipPosition;
  variant?: TooltipVariant;
  className?: string;
  offset?: number;
}

// Our custom tooltip component
export function Tooltip({ 
  children, 
  text, 
  delayMs = 700, 
  position = 'top',
  variant = 'dark',
  className = '',
  offset = 8
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [actualPosition, setActualPosition] = useState<TooltipPosition>(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Variant classes for styling
  const variantClasses = {
    dark: "bg-black text-white",
    light: "bg-white text-black border border-gray-200 dark:bg-neutral-800 dark:text-white dark:border-neutral-700"
  };

  // Calculate position based on trigger element
  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;
    
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    
    let top = 0;
    let left = 0;
    let newPosition = position;
    
    // Check if we need to flip the position due to viewport constraints
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    switch(position) {
      case 'top':
        // If tooltip would go above viewport, flip to bottom
        if (triggerRect.top - tooltipRect.height - offset < 0) {
          newPosition = 'bottom';
          top = triggerRect.bottom + offset;
        } else {
          top = triggerRect.top - tooltipRect.height - offset;
        }
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'bottom':
        // If tooltip would go below viewport, flip to top
        if (triggerRect.bottom + tooltipRect.height + offset > viewportHeight) {
          newPosition = 'top';
          top = triggerRect.top - tooltipRect.height - offset;
        } else {
          top = triggerRect.bottom + offset;
        }
        left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);
        break;
      case 'left':
        // If tooltip would go beyond left viewport, flip to right
        if (triggerRect.left - tooltipRect.width - offset < 0) {
          newPosition = 'right';
          left = triggerRect.right + offset;
        } else {
          left = triggerRect.left - tooltipRect.width - offset;
        }
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
      case 'right':
        // If tooltip would go beyond right viewport, flip to left
        if (triggerRect.right + tooltipRect.width + offset > viewportWidth) {
          newPosition = 'left';
          left = triggerRect.left - tooltipRect.width - offset;
        } else {
          left = triggerRect.right + offset;
        }
        top = triggerRect.top + (triggerRect.height / 2) - (tooltipRect.height / 2);
        break;
    }
    
    // Prevent tooltip from going off-screen horizontally
    if (left < 10) {
      left = 10;
    } else if (left + tooltipRect.width > viewportWidth - 10) {
      left = viewportWidth - tooltipRect.width - 10;
    }
    
    // Prevent tooltip from going off-screen vertically
    if (top < 10) {
      top = 10;
    } else if (top + tooltipRect.height > viewportHeight - 10) {
      top = viewportHeight - tooltipRect.height - 10;
    }
    
    // Add scroll position
    top += window.scrollY;
    left += window.scrollX;
    
    setTooltipPosition({ top, left });
    setActualPosition(newPosition);
  };

  // Handle mouse events
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
      // Reset position to initial prop value when showing
      setActualPosition(position);
      // Update position after state change and rendering
      setTimeout(updatePosition, 0);
    }, delayMs);
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    setIsVisible(false);
  };

  // Update position when window resizes
  useEffect(() => {
    if (isVisible) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition);
      
      return () => {
        window.removeEventListener('resize', updatePosition);
        window.removeEventListener('scroll', updatePosition);
      };
    }
  }, [isVisible]);

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
        className="inline-flex"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleMouseEnter}
        onBlur={handleMouseLeave}
      >
        {children}
      </div>
      
      {text && isVisible && typeof document !== 'undefined' && createPortal(
        <div
          ref={tooltipRef}
          className={`fixed px-2 py-1 rounded text-xs whitespace-nowrap shadow-sm ${variantClasses[variant]} ${getAnimationClass()} z-[9999] ${className}`}
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
          }}
        >
          {text}
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
