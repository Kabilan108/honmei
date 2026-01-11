import { Check, ChevronDown, Plus } from "lucide-react";
import type { JSX } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AniListMedia } from "@/lib/anilist";

type WatchStatus =
  | "COMPLETED"
  | "WATCHING"
  | "PLAN_TO_WATCH"
  | "DROPPED"
  | "ON_HOLD";

interface SearchResultCardProps {
  media: AniListMedia;
  isInLibrary: boolean;
  showStatusPicker: boolean;
  onToggleStatusPicker: () => void;
  onAddToLibrary: (status: WatchStatus) => void;
}

const statusOptions: {
  value: WatchStatus;
  animeLabel: string;
  mangaLabel: string;
}[] = [
  { value: "WATCHING", animeLabel: "Watching", mangaLabel: "Reading" },
  { value: "COMPLETED", animeLabel: "Completed", mangaLabel: "Completed" },
  {
    value: "PLAN_TO_WATCH",
    animeLabel: "Plan to Watch",
    mangaLabel: "Plan to Read",
  },
  { value: "ON_HOLD", animeLabel: "On Hold", mangaLabel: "On Hold" },
  { value: "DROPPED", animeLabel: "Dropped", mangaLabel: "Dropped" },
];

function StatusPicker({
  mediaType,
  onSelect,
}: {
  mediaType: "ANIME" | "MANGA";
  onSelect: (status: WatchStatus) => void;
}): JSX.Element {
  return (
    <div className="absolute right-0 bottom-full mb-1 z-10 bg-neutral-800 border border-neutral-700 shadow-lg min-w-[140px]">
      {statusOptions.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 transition-colors"
        >
          {mediaType === "ANIME" ? option.animeLabel : option.mangaLabel}
        </button>
      ))}
    </div>
  );
}

export function SearchResultCard({
  media,
  isInLibrary,
  showStatusPicker,
  onToggleStatusPicker,
  onAddToLibrary,
}: SearchResultCardProps): JSX.Element {
  return (
    <div className="bg-neutral-900 border border-neutral-800 overflow-hidden flex gap-4 p-4">
      <div className="w-24 h-36 bg-neutral-800 overflow-hidden flex-shrink-0">
        <img
          src={media.coverImage.large}
          alt={media.title.romaji}
          className="w-full h-full object-cover"
        />
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div>
          <h3
            className="font-medium line-clamp-2"
            title={media.title.english || media.title.romaji}
          >
            {media.title.english || media.title.romaji}
          </h3>
          {media.title.english && (
            <p
              className="text-sm text-neutral-400 line-clamp-1"
              title={media.title.romaji}
            >
              {media.title.romaji}
            </p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary" className="text-xs">
            {media.type}
          </Badge>
          {media.format?.trim() && (
            <Badge variant="outline" className="text-xs">
              {media.format}
            </Badge>
          )}
          {media.status?.trim() && (
            <Badge variant="outline" className="text-xs">
              {media.status}
            </Badge>
          )}
        </div>

        {media.genres.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {media.genres.slice(0, 3).map((genre) => (
              <span
                key={genre}
                className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <div className="text-sm space-x-3">
            {media.averageScore && (
              <span className="text-neutral-400">{media.averageScore}%</span>
            )}
            {(media.episodes || media.chapters) && (
              <span className="text-neutral-400">
                {media.type === "ANIME"
                  ? `${media.episodes} eps`
                  : `${media.chapters} ch`}
              </span>
            )}
          </div>

          <div className="relative">
            {isInLibrary ? (
              <Badge className="bg-green-600 hover:bg-green-600 text-white cursor-default">
                <Check className="w-3 h-3 mr-1" />
                In Library
              </Badge>
            ) : (
              <>
                <Button size="sm" onClick={onToggleStatusPicker}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                  <ChevronDown className="w-3 h-3 ml-1" />
                </Button>
                {showStatusPicker && (
                  <StatusPicker
                    mediaType={media.type}
                    onSelect={onAddToLibrary}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
