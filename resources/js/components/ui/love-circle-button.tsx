import * as React from "react"
import { Heart } from "lucide-react"
import { cn } from "@/lib/utils"

interface LoveCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string
    isLiked?: boolean
}

export function LoveCircleButton({ className, isLiked = false, ...props }: LoveCircleButtonProps) {
    return (
        <button
            type="button"
            className={cn(
                "p-1 rounded-full backdrop-blur border-2 border-black dark:border-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-300 transition-all duration-150 cursor-pointer",
                isLiked && "bg-primary border-primary hover:border-primary/80 dark:border-primary dark:hover:border-primary/80",
                className
            )}
            {...props}
        >
            <Heart className={cn(
                "h-8 w-8 p-1",
                isLiked && "text-white dark:text-black fill-neutral-500 dark:fill-neutral-300"
            )} />
        </button>
    )
} 