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
 * Avoids using IntersectionObserver to prevent conflicts with carousel behavior
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
  
  // Handle image load completion
  const handleImageLoaded = () => {
    setIsLoaded(true);
  };

  // Create wrapper styles
  const wrapperStyles: React.CSSProperties = {
    ...style,
    position: "relative",
    minHeight: style?.height || (className?.includes("h-") ? undefined : "100px"),
    overflow: "hidden",
  };

  // Style for the image with fade-in transition
  const imageStyles: React.CSSProperties = {
    ...style,
    opacity: isLoaded ? 1 : 0,
    transition: "opacity 0.3s ease-in-out",
  };

  return (
    <div className={`${className || ""}`} style={wrapperStyles}>
      {!isLoaded && (
        <div
          className="absolute inset-0 animate-pulse bg-neutral-200 dark:bg-neutral-800 rounded-md"
          style={{ ...style, backgroundColor: "#e5e7eb" }}
          aria-hidden="true"
        />
      )}
      
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className || ""}
        style={imageStyles}
        onLoad={handleImageLoaded}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
      />
    </div>
  );
} 