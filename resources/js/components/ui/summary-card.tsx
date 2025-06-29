import { Icon } from "@/components/icon";
import { type LucideProps } from 'lucide-react';
import { type ComponentType } from 'react';

type SummaryCardProps = {
  title: string;
  count: number;
  iconNode: ComponentType<LucideProps>;
  onClick: () => void;
  className?: string;
};

export function SummaryCard({ title, count, iconNode, onClick, className }: SummaryCardProps) {
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-lg p-4 cursor-pointer group transition-all duration-300 ease-in-out ${className}`}
    >
      <Icon
        iconNode={iconNode}
        className="absolute -bottom-5 -right-5 w-28 h-28 text-black/10 dark:text-white/10 transform-gpu transition-transform duration-500 ease-out rotate-[25deg] group-hover:scale-125 group-hover:-rotate-12"
      />
      
      <div className="relative z-10 flex flex-col justify-between h-full">
        <div className="flex flex-col md:flex-row justify-between items-start">
          <h3 className="font-semibold text-white/90 text-base xl:text-lg w-full py-1 md:py-2 mr-4 leading-tight">{title}</h3>
        </div>
        <p className="text-4xl md:text-5xl font-bold text-white mt-4">{count}</p>
      </div>
      
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/40 transition-colors duration-300"></div>
    </div>
  );
} 