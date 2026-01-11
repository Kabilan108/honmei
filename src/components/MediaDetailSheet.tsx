import { useMutation, useQuery } from "convex/react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/useMediaQuery";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

interface MediaDetailSheetProps {
  libraryItemId: Id<"userLibrary"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<
  WatchStatus,
  { label: string; mangaLabel?: string; className: string }
> = {
  COMPLETED: {
    label: "Completed",
    className: "bg-green-600/20 text-green-400 border-green-600/30",
  },
  WATCHING: {
    label: "Watching",
    mangaLabel: "Reading",
    className: "bg-blue-600/20 text-blue-400 border-blue-600/30",
  },
  PLAN_TO_WATCH: {
    label: "Plan to Watch",
    mangaLabel: "Plan to Read",
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

function getStatusLabel(
  status: WatchStatus,
  mediaType: "ANIME" | "MANGA",
): string {
  const config = statusConfig[status];
  if (mediaType === "MANGA" && config.mangaLabel) {
    return config.mangaLabel;
  }
  return config.label;
}

function formatDate(date?: {
  year?: number;
  month?: number;
  day?: number;
}): string {
  if (!date?.year) return "Unknown";
  const parts = [date.year];
  if (date.month) parts.push(date.month);
  if (date.day) parts.push(date.day);
  return parts.join("/");
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
}

export function MediaDetailSheet({
  libraryItemId,
  open,
  onOpenChange,
}: MediaDetailSheetProps) {
  const isMobile = useIsMobile();
  const data = useQuery(
    api.library.getByIdWithDetails,
    libraryItemId ? { id: libraryItemId } : "skip",
  );
  const updateItem = useMutation(api.library.updateLibraryItem);

  const handleStatusChange = (status: WatchStatus | null) => {
    if (libraryItemId && status) {
      updateItem({ id: libraryItemId, watchStatus: status });
    }
  };

  if (!data) {
    return null;
  }

  const { media, ...libraryItem } = data;
  const mediaType = media.type;

  const content = (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] md:max-h-none">
      <div className="flex gap-4">
        <img
          src={media.coverImage}
          alt={media.title}
          className="w-24 h-36 object-cover shrink-0"
        />
        <div className="flex flex-col gap-2 min-w-0">
          <h3 className="font-medium text-base leading-tight">
            {media.titleEnglish || media.title}
          </h3>
          {media.titleEnglish && media.title !== media.titleEnglish && (
            <p className="text-xs text-neutral-400">{media.title}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {mediaType}
            </Badge>
            {media.format && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {media.format}
              </Badge>
            )}
            {media.status && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                {media.status}
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2">
            <span className="text-xs text-neutral-400">Status:</span>
            <Select
              value={libraryItem.watchStatus}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger size="sm" className="h-6 text-[11px] w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(statusConfig) as WatchStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusLabel(status, mediaType)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-neutral-500">Elo Rating</span>
          <p className="font-mono text-blue-400">{libraryItem.eloRating}</p>
        </div>
        <div>
          <span className="text-neutral-500">Comparisons</span>
          <p className="font-mono">{libraryItem.comparisonCount}</p>
        </div>
        {mediaType === "ANIME" && media.episodes && (
          <div>
            <span className="text-neutral-500">Episodes</span>
            <p>{media.episodes}</p>
          </div>
        )}
        {mediaType === "MANGA" && media.chapters && (
          <div>
            <span className="text-neutral-500">Chapters</span>
            <p>{media.chapters}</p>
          </div>
        )}
        {media.averageScore && (
          <div>
            <span className="text-neutral-500">AniList Score</span>
            <p>{media.averageScore}%</p>
          </div>
        )}
        {media.startDate?.year && (
          <div>
            <span className="text-neutral-500">Started</span>
            <p>{formatDate(media.startDate)}</p>
          </div>
        )}
      </div>

      {media.genres.length > 0 && (
        <div>
          <span className="text-xs text-neutral-500 block mb-1.5">Genres</span>
          <div className="flex flex-wrap gap-1">
            {media.genres.map((genre) => (
              <span
                key={genre}
                className="text-[10px] bg-neutral-800 px-1.5 py-0.5 text-neutral-300"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      )}

      {media.tags.length > 0 && (
        <div>
          <span className="text-xs text-neutral-500 block mb-1.5">Tags</span>
          <div className="flex flex-wrap gap-1">
            {media.tags.slice(0, 10).map((tag) => (
              <span
                key={tag}
                className="text-[10px] bg-neutral-800/50 px-1.5 py-0.5 text-neutral-400"
              >
                {tag}
              </span>
            ))}
            {media.tags.length > 10 && (
              <span className="text-[10px] text-neutral-500">
                +{media.tags.length - 10} more
              </span>
            )}
          </div>
        </div>
      )}

      {media.description && (
        <div>
          <span className="text-xs text-neutral-500 block mb-1.5">
            Synopsis
          </span>
          <p className="text-xs text-neutral-300 leading-relaxed">
            {stripHtml(media.description)}
          </p>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left">
              {media.titleEnglish || media.title}
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{media.titleEnglish || media.title}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
