import * as React from "react"
import { Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface StarRatingProps {
  rating: number
  className?: string
  size?: number
}

export function StarRating({ rating, className, size = 2.5 }: StarRatingProps) {
  // Ensure rating is between 0 and 5
  const normalizedRating = Math.min(Math.max(rating, 0), 5)
  
  // Calculate full and half stars
  const fullStars = Math.floor(normalizedRating)
  const hasHalfStar = normalizedRating % 1 !== 0
  
  const starStyle = { height: `${size * 0.25}rem`, width: `${size * 0.25}rem` }
  
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {[...Array(5)].map((_, index) => {
        if (index < fullStars) {
          return <Star key={index} style={starStyle} className="dark:fill-amber-500 fill-amber-300 dark:text-amber-500 text-amber-700" />
        } else if (index === fullStars && hasHalfStar) {
          return (
            <div key={index} className="relative">
              <Star style={starStyle} className="text-neutral-400 dark:text-neutral-500" />
              <div className="absolute inset-0 w-1/2 overflow-hidden">
                <Star style={starStyle} className="dark:fill-amber-500 fill-amber-300 dark:text-amber-500 text-amber-700" />
              </div>
            </div>
          )
        } else {
          return <Star key={index} style={starStyle} className="text-neutral-400 dark:text-neutral-500" />
        }
      })}
    </div>
  )
} 