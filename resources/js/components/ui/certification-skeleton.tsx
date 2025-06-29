import { Skeleton } from "./skeleton";

export function CertificationSkeleton() {
  return (
    <div className="flex flex-col gap-y-7">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-[10vh] w-full" />
    </div>
  );
} 