# ShadCN + Embla Carousel Reference

This document explains how the existing carousel works in this codebase and how to transplant the exact implementation (structure, behaviors, and animations) into another project.

## What the carousel consists of
- Core component: `resources/js/components/ui/carousel.tsx`
- Depends on:
  - `embla-carousel-react` (and its peer `embla-carousel`)
  - `lucide-react` icons (`ArrowLeft`, `ArrowRight`)
  - Local UI pieces: `@/components/ui/button` for the controls and `@/lib/utils` (`cn` className merge helper)
  - TailwindCSS (utility classes in the JSX)

## Features and behaviors
- Horizontal or vertical orientation (prop `orientation`).
- Keyboard support (ArrowLeft/ArrowRight on the wrapper).
- Previous/next buttons that disable when you cannot scroll further.
- Slide container uses GPU-friendly transforms (`translate3d`, `will-change`) for smooth Embla animations.
- Optional `setApi` prop exposes the Embla API for pagination or custom indicators.
- Supports Embla plugins via the `plugins` prop and any `opts` passed to `useEmblaCarousel`.

## Files to copy
Copy `resources/js/components/ui/carousel.tsx` as-is to the target project (adjust import paths for `Button` and `cn`).

## Installation steps in a new project
1) Install dependencies:
   ```bash
   npm i embla-carousel embla-carousel-react lucide-react
   ```
2) Ensure you have a ShadCN-style `Button` component and a `cn` helper. If not, adapt imports to whatever button/cx helper your project uses.
3) Copy the carousel file and update imports:
   - Point `Button` to your button component.
   - Point `cn` to your class merge helper.
   - Keep the lucide icons or swap for your icon set.
4) Tailwind setup: no extra CSS is required; the component relies on Tailwind utility classes already present in JSX.

## Usage example
```tsx
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"

export function DemoCarousel() {
  return (
    <Carousel className="w-full max-w-4xl">
      <CarouselContent>
        {["One", "Two", "Three"].map((item) => (
          <CarouselItem key={item} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-4 bg-muted rounded-lg text-center h-32">
              {item}
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  )
}
```

## Notes on animations and interaction
- Embla handles the smooth slide animation; `CarouselContent` and its inner `<div>` set `translate3d` plus `will-change` for GPU acceleration.
- Button placement is absolutely positioned: to the left/right (horizontal) or rotated and placed above/below (vertical).
- The component listens to Embla `select` and `reInit` events to keep `canScrollPrev/Next` in sync, which is why the buttons disable appropriately.

## Extending
- Pass `opts` (e.g., `{ loop: true, align: "start" }`) to tweak scroll physics.
- Pass `plugins` (e.g., Embla Autoplay) to add behaviors; no code changes required.
- Use `setApi={(api) => setCarouselApi(api)}` to drive custom dots or programmatic navigation.


