import * as React from "react"
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem, 
  CarouselNext, 
  CarouselPrevious, 
  type CarouselApi 
} from "@/components/ui/carousel"

type RibbonProps = {
  /**
   * The content of the ribbon
   */
  children: React.ReactNode
  /**
   * The alignment of the ribbon items
   * @default "start"
   */
  align?: "start" | "center" | "end"
  /**
   * Whether the ribbon should drag freely
   * @default true
   */
  dragFree?: boolean
  /**
   * Additional CSS class names for the ribbon
   */
  className?: string
  /**
   * The position of the navigation buttons
   * @default "top"
   */
  navPosition?: "top" | "side" | "none"
  /**
   * Optional callback for when the carousel API is initialized
   */
  onApiInitialized?: (api: CarouselApi) => void
}

/**
 * A reusable carousel ribbon component for consistent styling across the application
 */
export function Ribbon({
  children,
  align = "start",
  dragFree = true,
  className = "",
  navPosition = "top",
  onApiInitialized,
}: RibbonProps) {
  const [api, setApi] = React.useState<CarouselApi>()

  React.useEffect(() => {
    if (!api || !onApiInitialized) return
    onApiInitialized(api)
  }, [api, onApiInitialized])

  // Add keyboard navigation
  React.useEffect(() => {
    if (!api) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        api.scrollPrev()
      } else if (e.key === "ArrowRight") {
        api.scrollNext()
      }
    }

    // Add event listener
    window.addEventListener("keydown", handleKeyDown)

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [api])

  return (
    <Carousel
      opts={{
        align: align,
        dragFree: dragFree,
      }}
      className={`w-full select-none ${className}`}
      setApi={setApi}
    >
      {navPosition === "top" && (
        <>
          <CarouselPrevious className="relative ml-12 -mr-[5.7rem]" />
          <CarouselNext className="relative" />
        </>
      )}
      {navPosition === "side" && (
        <>
          <CarouselPrevious className="absolute left-0 mt-2 top-1/3 -translate-x-1.5 z-40" />
          <CarouselNext className="absolute right-0 mt-2 top-1/3 translate-x-1.5 z-40" />
        </>
      )}
      <CarouselContent>
        {children}
      </CarouselContent>
    </Carousel>
  )
}

// Define a simpler interface for RibbonItem props
interface RibbonItemProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

/**
 * A wrapper for CarouselItem with default styling for the Ribbon component
 */
export function RibbonItem({
  children,
  className,
  onClick,
}: RibbonItemProps) {
  return (
    <CarouselItem 
      className={`group basis-auto ${className || ""}`}
      onClick={onClick}
    >
      <div style={{ minHeight: '150px', minWidth: '100px' }}>
        {children}
      </div>
    </CarouselItem>
  );
} 