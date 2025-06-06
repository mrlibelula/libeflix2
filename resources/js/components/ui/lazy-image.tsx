import * as React from "react";

interface LazyImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  style?: React.CSSProperties;
  priority?: boolean;
}

/**
 * A component that lazily loads images using native browser lazy loading
 * Optimized to prevent layout shifts and ensure smooth carousel animations
 */
export function LazyImage({
  src,
  alt,
  className,
  width,
  height,
  style,
  priority = false,
}: LazyImageProps) {
  const [isLoaded, setIsLoaded] = React.useState(false);
  const [hasError, setHasError] = React.useState(false);
  
  // Handle image load completion
  const handleImageLoaded = () => {
    setIsLoaded(true);
  };

  // Handle image load error
  const handleImageError = () => {
    setHasError(true);
    setIsLoaded(true); // Set to true to hide skeleton
  };

  // Only apply explicit dimensions if width/height props are provided
  // Otherwise let Tailwind classes handle the sizing
  const wrapperStyles: React.CSSProperties = {
    position: "relative",
    overflow: "hidden",
    display: "block",
    ...(width && { width }),
    ...(height && { height }),
    ...style,
  };

  // Style for the skeleton placeholder
  const skeletonStyles: React.CSSProperties = {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    backgroundColor: "#e5e7eb",
    opacity: isLoaded ? 0 : 1,
    transition: "opacity 0.2s ease-out",
    pointerEvents: "none",
  };

  // Style for the image - always visible to maintain layout
  const imageStyles: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    opacity: isLoaded ? 1 : 0,
    transition: "opacity 0.2s ease-out",
    // Use transform3d to enable hardware acceleration
    transform: "translate3d(0, 0, 0)",
    backfaceVisibility: "hidden",
  };

  return (
    <div className={className || ""} style={wrapperStyles}>
      {/* Skeleton/Loading placeholder */}
      <div
        className="animate-pulse bg-zinc-200 dark:bg-zinc-800"
        style={skeletonStyles}
        aria-hidden="true"
      />
      
      {/* Actual image */}
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        style={imageStyles}
        onLoad={handleImageLoaded}
        onError={handleImageError}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        draggable={false} // Prevent image dragging which can interfere with carousel
      />
      
      {/* Error state fallback */}
      {hasError && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            backgroundColor: "#f3f4f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#6b7280",
            fontSize: "12px",
          }}
        >
          Image unavailable
        </div>
      )}
    </div>
  );
} 