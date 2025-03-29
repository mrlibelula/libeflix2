import { cn } from "@/lib/utils";

interface CreditPosterProps {
  imageUrl: string;
  name: string;
  characterName?: string;
  className?: string;
}

export function CreditPoster({ imageUrl, name, characterName, className }: CreditPosterProps) {
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div 
        className="mx-auto w-[7rem] h-[10rem] bg-cover bg-center rounded-md overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity duration-150" 
        style={{ backgroundImage: `url(${imageUrl})` }}
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