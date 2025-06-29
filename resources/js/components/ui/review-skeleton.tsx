import { Skeleton } from "./skeleton";

export function ReviewSkeleton() {
  return (
    <div className="flex flex-col gap-y-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="flex items-start gap-x-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="flex flex-col gap-y-2 flex-1">
          <div className="flex items-center gap-x-3">
            <Skeleton className="h-5 w-24" />
            <div className="flex gap-x-1">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="w-4 h-4 rounded-sm" />
              ))}
            </div>
          </div>
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ReviewsListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-7">
      {[...Array(count)].map((_, i) => (
        <ReviewSkeleton key={i} />
      ))}
    </div>
  );
} 