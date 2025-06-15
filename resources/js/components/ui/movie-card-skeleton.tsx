import React from 'react';

interface MovieCardSkeletonProps {
  count?: number;
  className?: string;
}

export function MovieCardSkeleton({ count = 5, className = '' }: MovieCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className={`animate-pulse ${className}`}>
          <div className="bg-gray-300 dark:bg-gray-700 rounded-lg aspect-[2/3] w-full"></div>
          <div className="mt-2 space-y-1">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-3 bg-gray-300 dark:bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      ))}
    </>
  );
} 