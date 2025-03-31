import * as React from "react"
import { Plus } from "lucide-react"
import { cn } from "@/lib/utils"

interface AddCircleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    className?: string
}

export function AddCircleButton({ className, ...props }: AddCircleButtonProps) {
    return (
        <button
            type="button"
            className={cn(
                "p-1 rounded-full backdrop-blur border-2 border-black dark:border-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-300 transition-all duration-150 cursor-pointer",
                className
            )}
            {...props}
        >
            <Plus className="h-8 w-8 p-0.5" />
        </button>
    )
} 