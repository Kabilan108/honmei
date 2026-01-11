import { Skeleton } from "@/components/ui/skeleton";

export function ComparisonCardSkeleton() {
  return (
    <div className="bg-neutral-900 border-2 border-neutral-800 overflow-hidden">
      <div className="aspect-[4/5] md:aspect-[3/4] bg-neutral-800 relative">
        <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 space-y-2 md:space-y-3">
          <Skeleton className="h-6 md:h-7 w-3/4 rounded-none" />
          <Skeleton className="h-5 w-1/2 rounded-none" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-none" />
            <Skeleton className="h-5 w-12 rounded-none" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <Skeleton className="h-6 w-20 rounded-none" />
            <Skeleton className="h-4 w-16 rounded-none" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ComparisonPairSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <ComparisonCardSkeleton />
      <ComparisonCardSkeleton />
    </div>
  );
}
