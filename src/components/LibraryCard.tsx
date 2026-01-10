import { Trash2 } from "lucide-react";
import { memo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

interface LibraryItem {
  _id: string;
  eloRating: number;
  comparisonCount: number;
  watchStatus: WatchStatus;
  // Denormalized media fields
  mediaTitle: string;
  mediaCoverImage: string;
  mediaGenres: string[];
  mediaType: "ANIME" | "MANGA";
}

interface LibraryCardProps {
  item: LibraryItem;
  rank: number;
  totalItems: number;
  onRemove: (args: { id: string }) => Promise<void>;
}

const statusConfig: Record<WatchStatus, { label: string; className: string }> =
  {
    COMPLETED: {
      label: "Completed",
      className: "bg-green-600/20 text-green-400 border-green-600/30",
    },
    WATCHING: {
      label: "Watching",
      className: "bg-blue-600/20 text-blue-400 border-blue-600/30",
    },
    PLAN_TO_WATCH: {
      label: "Plan to Watch",
      className: "bg-yellow-600/20 text-yellow-400 border-yellow-600/30",
    },
    DROPPED: {
      label: "Dropped",
      className: "bg-red-600/20 text-red-400 border-red-600/30",
    },
    ON_HOLD: {
      label: "On Hold",
      className: "bg-orange-600/20 text-orange-400 border-orange-600/30",
    },
  };

export const LibraryCard = memo(function LibraryCard({
  item,
  rank,
  totalItems,
  onRemove,
}: LibraryCardProps) {
  // Calculate percentile score (0-10, inverted so #1 is 10.0)
  const calculateScore = (): string | null => {
    if (totalItems < 5) return null;
    // rank 1 = 10.0, last rank = 0.0
    const score = ((totalItems - rank) / (totalItems - 1)) * 10;
    return score.toFixed(1);
  };

  const score = calculateScore();
  const statusInfo = statusConfig[item.watchStatus];
  const displayGenres = item.mediaGenres.slice(0, 2);

  const handleRemove = () => {
    onRemove({ id: item._id });
  };

  return (
    <div className="bg-neutral-900 overflow-hidden border border-neutral-800 group relative">
      {/* Cover Image with Rank Overlay */}
      <div className="aspect-[2/3] bg-neutral-800 relative">
        <img
          src={item.mediaCoverImage}
          alt={item.mediaTitle}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        {/* Rank Badge - Top Left */}
        <div className="absolute top-0 left-0 bg-black/80 px-2 py-1 text-sm font-bold text-white">
          #{rank}
        </div>

        {/* Score Badge - Top Right */}
        <div className="absolute top-0 right-0 bg-black/80 px-2 py-1 text-sm font-mono">
          {score !== null ? (
            <span className="text-blue-400">{score}</span>
          ) : (
            <span className="text-neutral-500 text-xs">--</span>
          )}
        </div>

        {/* Remove Button - Shows on Hover */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button
                  variant="destructive"
                  size="icon-xs"
                  className="bg-red-600/90 hover:bg-red-600 border-none"
                />
              }
            >
              <Trash2 className="size-3" />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Remove from Library</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to remove "{item.mediaTitle}" from your
                  library? This will also remove all comparison history for this
                  item.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleRemove}>
                  Remove
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <h3 className="font-medium text-sm line-clamp-2 leading-tight">
          {item.mediaTitle}
        </h3>

        {/* Status Badge */}
        <Badge
          variant="outline"
          className={`text-[10px] px-1.5 py-0 h-4 ${statusInfo.className}`}
        >
          {statusInfo.label}
        </Badge>

        {/* Genre Tags */}
        {displayGenres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {displayGenres.map((genre) => (
              <span
                key={genre}
                className="text-[10px] text-neutral-400 bg-neutral-800 px-1.5 py-0.5"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Comparison Count */}
        <div className="text-[10px] text-neutral-500 pt-1">
          {item.comparisonCount} comparisons
        </div>
      </div>
    </div>
  );
});
