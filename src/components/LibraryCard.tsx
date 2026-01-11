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
import {
  getStatusLabel,
  type MediaType,
  STATUS_CONFIG,
  STATUS_CYCLE,
  type WatchStatus,
} from "@/lib/status";

interface LibraryItem {
  _id: string;
  eloRating: number;
  comparisonCount: number;
  watchStatus: WatchStatus;
  mediaTitle: string;
  mediaCoverImage: string;
  mediaGenres: string[];
  mediaType: MediaType;
}

interface LibraryCardProps {
  item: LibraryItem;
  rank: number;
  totalItems: number;
  onRemove: (args: { id: string }) => Promise<void>;
  onStatusChange?: (args: { id: string; watchStatus: WatchStatus }) => void;
  onClick?: () => void;
}

export const LibraryCard = memo(function LibraryCard({
  item,
  rank,
  totalItems,
  onRemove,
  onStatusChange,
  onClick,
}: LibraryCardProps) {
  const calculateScore = (): string | null => {
    if (totalItems < 5) return null;
    const score = ((totalItems - rank) / (totalItems - 1)) * 10;
    return score.toFixed(1);
  };

  const score = calculateScore();
  const statusInfo = STATUS_CONFIG[item.watchStatus];
  const statusLabel = getStatusLabel(item.watchStatus, item.mediaType);
  const displayGenres = item.mediaGenres.slice(0, 2);

  const handleRemove = () => {
    onRemove({ id: item._id });
  };

  const handleStatusCycle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onStatusChange) return;
    const currentIndex = STATUS_CYCLE.indexOf(item.watchStatus);
    const nextIndex = (currentIndex + 1) % STATUS_CYCLE.length;
    onStatusChange({ id: item._id, watchStatus: STATUS_CYCLE[nextIndex] });
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: card with nested interactive elements requires div wrapper
    <div
      className="bg-neutral-900 overflow-hidden border border-neutral-800 group relative cursor-pointer transition-all duration-200 hover:border-neutral-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
      tabIndex={0}
      role="button"
    >
      <div className="aspect-[2/3] bg-neutral-800 relative">
        <img
          src={item.mediaCoverImage}
          alt={item.mediaTitle}
          loading="lazy"
          className="w-full h-full object-cover"
        />

        <div className="absolute top-0 left-0 bg-black/80 px-2 py-1 text-sm font-bold text-white">
          #{rank}
        </div>

        <div className="absolute top-0 right-0 bg-black/80 px-2 py-1 text-sm font-mono">
          {score !== null ? (
            <span className="text-primary">{score}</span>
          ) : (
            <span className="text-neutral-500 text-xs">--</span>
          )}
        </div>

        {/* biome-ignore lint/a11y/noStaticElementInteractions: stop propagation wrapper for nested button */}
        {/* biome-ignore lint/a11y/useKeyWithClickEvents: keyboard handled by nested button */}
        <div
          className="absolute bottom-2 right-2 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
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

      <div className="p-3 flex flex-col h-[140px]">
        <h3
          className="font-medium text-sm line-clamp-2 leading-tight max-h-[2.2rem] overflow-hidden"
          title={item.mediaTitle}
        >
          {item.mediaTitle}
        </h3>

        <div className="mt-auto space-y-1.5">
          <button
            type="button"
            onClick={handleStatusCycle}
            className="text-left"
          >
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 h-4 cursor-pointer hover:opacity-80 transition-opacity ${statusInfo.className}`}
            >
              {statusLabel}
            </Badge>
          </button>

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

          <div className="text-[10px] text-neutral-500">
            {item.comparisonCount} comparisons
          </div>
        </div>
      </div>
    </div>
  );
});
