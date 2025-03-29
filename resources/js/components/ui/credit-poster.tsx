import { cn } from "@/lib/utils";
import { LazyImage } from "./lazy-image";

interface CreditPosterProps {
  imageUrl: string;
  name: string;
  characterName?: string;
  className?: string;
  priority?: boolean;
}

export function CreditPoster({ 
  imageUrl, 
  name, 
  characterName, 
  className,
  priority = false
}: CreditPosterProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <LazyImage 
        src={imageUrl}
        alt={name}
        className="mx-auto w-[7rem] h-[10rem] rounded-md overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity duration-150 object-cover"
        priority={priority}
      />
      <div className="mt-6 text-xs leading-tight rounded-md text-center w-full max-w-[8rem] mx-auto text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors duration-150 line-clamp-2">
        {name}
      </div>
      {/* character name (optional) */}
      {characterName && (
        <div className="text-xs leading-tight text-center w-full max-w-[8rem] mx-auto text-rose-500 dark:text-rose-400 group-hover:text-rose-600 dark:group-hover:text-rose-300 line-clamp-2 transition-colors duration-150">
          {characterName}
        </div>
      )}
    </div>
  );
} 