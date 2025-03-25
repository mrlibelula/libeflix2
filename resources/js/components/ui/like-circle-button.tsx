import * as React from "react"
import { ThumbsUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface LikeCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string
    isLiked?: boolean
}

export function LikeCircleButton({ className, isLiked = false, ...props }: LikeCircleButtonProps) {
    return (
        <button
            type="button"
            className={cn(
                "p-1 rounded-full border-2 border-black dark:border-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-300 transition-all duration-150",
                isLiked && "bg-primary border-primary hover:border-primary/80 dark:border-primary dark:hover:border-primary/80",
                className
            )}
            {...props}
        >
            <ThumbsUp className={cn(
                "h-8 w-8 p-1",
                isLiked && "text-white dark:text-black fill-neutral-500 dark:fill-neutral-300"
            )} />
        </button>
    )
} 