import { useMutation, useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { getStatusLabel, STATUS_CONFIG, type WatchStatus } from "@/lib/status";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

interface MediaDetailSheetProps {
  libraryItemId: Id<"userLibrary"> | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const titleInputRef = useRef<HTMLInputElement>(null);

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

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  // Reset edit state when sheet closes
  useEffect(() => {
    if (!open) {
      setIsEditingTitle(false);
    }
  }, [open]);

  if (!data) {
    return null;
  }

  const { media, ...libraryItem } = data;
  const mediaType = media.type;
  const defaultTitle = media.titleEnglish || media.title;
  const displayTitle = libraryItem.customTitle || defaultTitle;

  const handleStartEdit = () => {
    setEditedTitle(displayTitle);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    if (libraryItemId && editedTitle.trim()) {
      const trimmed = editedTitle.trim();
      // Only save if different from default and current custom title
      if (trimmed !== defaultTitle || libraryItem.customTitle) {
        updateItem({
          id: libraryItemId,
          customTitle: trimmed === defaultTitle ? undefined : trimmed,
        });
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSaveTitle();
    } else if (e.key === "Escape") {
      setIsEditingTitle(false);
    }
  };

  const statusPicker = isMobile ? (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(STATUS_CONFIG) as WatchStatus[]).map((status) => {
        const config = STATUS_CONFIG[status];
        const isActive = libraryItem.watchStatus === status;
        return (
          <button
            key={status}
            type="button"
            onClick={() => handleStatusChange(status)}
            className={`text-[10px] px-2 py-1 border transition-colors ${
              isActive
                ? config.className
                : "border-neutral-700 text-neutral-400 hover:border-neutral-600"
            }`}
          >
            {getStatusLabel(status, mediaType)}
          </button>
        );
      })}
    </div>
  ) : (
    <Select value={libraryItem.watchStatus} onValueChange={handleStatusChange}>
      <SelectTrigger size="sm" className="h-6 text-[11px] w-auto">
        <SelectValue>
          {getStatusLabel(libraryItem.watchStatus, mediaType)}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(STATUS_CONFIG) as WatchStatus[]).map((status) => (
          <SelectItem key={status} value={status}>
            {getStatusLabel(status, mediaType)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  const content = (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] md:max-h-none">
      <div className="flex gap-4">
        <img
          src={media.coverImage}
          alt={media.title}
          className="w-28 h-[168px] md:w-32 md:h-48 object-cover shrink-0"
        />
        <div className="flex flex-col gap-2 min-w-0">
          {media.titleEnglish && media.title !== media.titleEnglish && (
            <p className="text-xs text-neutral-400">{media.title}</p>
          )}

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
              {mediaType}
            </Badge>
            {media.format && media.format !== mediaType && (
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

          <div className="mt-2">
            <span className="text-xs text-neutral-400 block mb-1.5">
              Status
            </span>
            {statusPicker}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="text-neutral-500">Elo Rating</span>
          <p className="font-mono text-primary">{libraryItem.eloRating}</p>
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

  const titleElement = isEditingTitle ? (
    <input
      ref={titleInputRef}
      type="text"
      value={editedTitle}
      onChange={(e) => setEditedTitle(e.target.value)}
      onBlur={handleSaveTitle}
      onKeyDown={handleTitleKeyDown}
      className="bg-transparent border-b border-primary outline-none text-inherit font-inherit w-full"
    />
  ) : (
    <button
      type="button"
      onClick={handleStartEdit}
      className="flex items-center gap-2 text-left hover:text-primary transition-colors group"
    >
      <span>{displayTitle}</span>
      <Pencil className="size-3 opacity-0 group-hover:opacity-100 transition-opacity text-neutral-400" />
    </button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="text-left">{titleElement}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-6">{content}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{titleElement}</DialogTitle>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
