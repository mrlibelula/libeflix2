import { cn } from "@/lib/utils";
import { Link } from "@inertiajs/react";

type ColorVariant = 
  | 'emerald' 
  | 'pink' 
  | 'rose' 
  | 'orange' 
  | 'sky' 
  | 'blue' 
  | 'indigo' 
  | 'white' 
  | 'black' 
  | 'yellow' 
  | 'green' 
  | 'violet' 
  | 'fuchsia' 
  | 'neutral' 
  | 'stone';

type SizeVariant = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface OutlineButtonProps {
  href?: string;
  color?: ColorVariant;
  size?: SizeVariant;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

const colorStyles: Record<ColorVariant, string> = {
  emerald: 'border-emerald-500 dark:border-emerald-900 text-emerald-500 dark:text-emerald-400 hover:bg-emerald-500 dark:hover:bg-emerald-900 hover:text-white dark:hover:text-white',
  pink: 'border-pink-500 dark:border-pink-900 text-pink-500 dark:text-pink-400 hover:bg-pink-500 dark:hover:bg-pink-900 hover:text-white dark:hover:text-white',
  rose: 'border-rose-500 dark:border-rose-900 text-rose-500 dark:text-rose-400 hover:bg-rose-500 dark:hover:bg-rose-900 hover:text-white dark:hover:text-white',
  orange: 'border-orange-500 dark:border-orange-900 text-orange-500 dark:text-orange-400 hover:bg-orange-500 dark:hover:bg-orange-900 hover:text-white dark:hover:text-white',
  sky: 'border-sky-500 dark:border-sky-900 text-sky-500 dark:text-sky-400 hover:bg-sky-500 dark:hover:bg-sky-900 hover:text-white dark:hover:text-white',
  blue: 'border-rose-500 dark:border-rose-900 text-rose-500 dark:text-rose-400 hover:bg-rose-500 dark:hover:bg-rose-900 hover:text-white dark:hover:text-white',
  indigo: 'border-indigo-500 dark:border-indigo-900 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500 dark:hover:bg-indigo-900 hover:text-white dark:hover:text-white',
  white: 'border-white dark:border-white text-white dark:text-white hover:bg-white hover:text-black dark:hover:text-black',
  black: 'border-black dark:border-black text-black dark:text-black hover:bg-black hover:text-white dark:hover:text-white',
  yellow: 'border-yellow-500 dark:border-yellow-900 text-yellow-500 dark:text-yellow-400 hover:bg-yellow-500 dark:hover:bg-yellow-900 hover:text-white dark:hover:text-white',
  green: 'border-green-500 dark:border-green-900 text-green-500 dark:text-green-400 hover:bg-green-500 dark:hover:bg-green-900 hover:text-white dark:hover:text-white',
  violet: 'border-violet-500 dark:border-violet-900 text-violet-500 dark:text-violet-400 hover:bg-violet-500 dark:hover:bg-violet-900 hover:text-white dark:hover:text-white',
  fuchsia: 'border-fuchsia-500 dark:border-fuchsia-900 text-fuchsia-500 dark:text-fuchsia-400 hover:bg-fuchsia-500 dark:hover:bg-fuchsia-900 hover:text-white dark:hover:text-white',
  neutral: 'border-neutral-500 dark:border-neutral-900 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-500 dark:hover:bg-neutral-900 hover:text-white dark:hover:text-white',
  stone: 'border-stone-500 dark:border-stone-900 text-stone-500 dark:text-stone-400 hover:bg-stone-500 dark:hover:bg-stone-900 hover:text-white dark:hover:text-white',
};

const sizeStyles: Record<SizeVariant, string> = {
  xs: 'text-xs px-2 py-1',
  sm: 'text-sm px-3 py-1.5',
  md: 'text-base px-4 py-2',
  lg: 'text-lg px-5 py-2.5',
  xl: 'text-xl px-6 py-3',
};

export function OutlineButton({ 
  href, 
  color = 'green', 
  size = 'xs',
  children, 
  className,
  onClick 
}: OutlineButtonProps) {
  const baseStyles = 'flex items-center justify-between gap-x-2 border rounded-sm font-semibold w-fit cursor-pointer transition-colors duration-150';
  
  const buttonContent = (
    <div className={cn(
      baseStyles,
      colorStyles[color],
      sizeStyles[size],
      className
    )}>
      {children}
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        {buttonContent}
      </Link>
    );
  }

  return (
    <div onClick={onClick}>
      {buttonContent}
    </div>
  );
} 