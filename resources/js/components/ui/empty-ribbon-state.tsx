import { ClapperboardIcon, PlusIcon, SearchIcon, StarIcon } from "lucide-react";

interface EmptyRibbonStateProps {
  title?: string;
  description?: string;
  icon?: "clapper" | "plus" | "search" | "star";
  actionText?: string;
  onAction?: () => void;
}

export function EmptyRibbonState({ 
  title = "No movies found",
  description = "There are no movies to display at the moment.",
  icon = "clapper",
}: EmptyRibbonStateProps) {
  const iconComponents = {
    clapper: ClapperboardIcon,
    plus: PlusIcon,
    search: SearchIcon,
    star: StarIcon,
  };

  const IconComponent = iconComponents[icon];

  return (
    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
      {/* Animated icon container */}
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="relative bg-gradient-to-br from-zinc-100 to-zinc-200 dark:from-zinc-800 dark:to-zinc-900 rounded-full p-6 border border-zinc-200 dark:border-zinc-700 shadow-lg">
          <IconComponent className="w-12 h-12 text-zinc-400 dark:text-zinc-500" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
        {title}
      </h3>

      {/* Description */}
      <p className="text-zinc-600 dark:text-zinc-400 max-w-md leading-relaxed mb-6">
        {description}
      </p>
    </div>
  );
} 