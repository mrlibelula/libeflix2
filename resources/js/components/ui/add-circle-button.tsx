import * as React from "react"
import { Plus, Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string
    isWatchLater?: boolean
    isToggling?: boolean
}

export function AddCircleButton({ className, isWatchLater = false, isToggling = false, ...props }: AddCircleButtonProps) {
    return (
        <button
            type="button"
            className={cn(
                "p-1 rounded-full backdrop-blur border-2 transition-all duration-150 cursor-pointer",
                isWatchLater 
                    ? "bg-green-600 border-green-600 hover:bg-green-700 hover:border-green-700" 
                    : "border-black dark:border-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-300",
                isToggling && "opacity-50 cursor-not-allowed",
                className
            )}
            disabled={isToggling}
            {...props}
        >
            {isWatchLater ? (
                <Check className={cn(
                    "h-8 w-8 p-0.5 text-white"
                )} />
            ) : (
                <Plus className={cn(
                    "h-8 w-8 p-0.5"
                )} />
            )}
        </button>
    )
} 