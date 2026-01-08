import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { searchAniList, type AniListMedia } from "@/lib/anilist";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Check, ChevronDown } from "lucide-react";

type WatchStatus = "COMPLETED" | "WATCHING" | "PLAN_TO_WATCH" | "DROPPED" | "ON_HOLD";

interface StatusPickerProps {
  mediaType: "ANIME" | "MANGA";
  onSelect: (status: WatchStatus) => void;
  onClose: () => void;
}

function StatusPicker({ mediaType, onSelect, onClose }: StatusPickerProps) {
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    // Use setTimeout to avoid immediate trigger on the same click that opened the picker
    const timeoutId = setTimeout(() => {
      document.addEventListener("click", handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("click", handleClickOutside);
    };
  }, [onClose]);

  const watchingLabel = mediaType === "ANIME" ? "Watching" : "Reading";

  return (
    <div
      ref={pickerRef}
      className="absolute right-0 bottom-full mb-1 z-10 bg-neutral-800 border border-neutral-700 shadow-lg min-w-[140px]"
    >
      <button
        onClick={() => onSelect("WATCHING")}
        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 transition-colors"
      >
        {watchingLabel}
      </button>
      <button
        onClick={() => onSelect("COMPLETED")}
        className="w-full px-3 py-2 text-left text-sm hover:bg-neutral-700 transition-colors"
      >
        Completed
      </button>
    </div>
  );
}

export function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ANIME" | "MANGA">("ALL");
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());
  const [activeStatusPicker, setActiveStatusPicker] = useState<number | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastSearchTerm, setLastSearchTerm] = useState("");
  const [lastFilter, setLastFilter] = useState<"ALL" | "ANIME" | "MANGA">("ALL");

  // Query existing library items
  const libraryAnilistIds = useQuery(api.library.getAnilistIds);
  const libraryIdsSet = new Set(libraryAnilistIds ?? []);

  const upsertMedia = useMutation(api.media.upsertMediaItem);
  const addToLibrary = useMutation(api.library.addToLibrary);

  const handleSearch = async (page: number = 1, append: boolean = false) => {
    if (!searchTerm.trim()) return;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setResults([]);
    }

    try {
      const type = filter === "ALL" ? undefined : filter;
      const pageData = await searchAniList(searchTerm, type, page);

      if (append) {
        setResults((prev) => [...prev, ...pageData.media]);
      } else {
        setResults(pageData.media);
        setLastSearchTerm(searchTerm);
        setLastFilter(filter);
      }

      setCurrentPage(page);
      setHasNextPage(pageData.pageInfo.hasNextPage);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    handleSearch(currentPage + 1, true);
  };

  // Helper to convert null values to undefined for Convex compatibility
  const cleanDate = (date: { year?: number | null; month?: number | null; day?: number | null } | null | undefined) => {
    if (!date) return undefined;
    return {
      year: date.year ?? undefined,
      month: date.month ?? undefined,
      day: date.day ?? undefined,
    };
  };

  const handleAddToLibrary = async (media: AniListMedia, status: WatchStatus) => {
    try {
      // First, upsert the media item
      const mediaId = await upsertMedia({
        anilistId: media.id,
        malId: media.idMal ?? undefined,
        type: media.type,
        title: media.title.romaji,
        titleEnglish: media.title.english ?? undefined,
        titleJapanese: media.title.native ?? undefined,
        description: media.description ?? undefined,
        coverImage: media.coverImage.extraLarge,
        bannerImage: media.bannerImage ?? undefined,
        genres: media.genres,
        tags: media.tags.map((t) => t.name),
        format: media.format ?? undefined,
        status: media.status ?? undefined,
        episodes: media.episodes ?? undefined,
        chapters: media.chapters ?? undefined,
        averageScore: media.averageScore ?? undefined,
        popularity: media.popularity ?? undefined,
        startDate: cleanDate(media.startDate),
        endDate: cleanDate(media.endDate),
      });

      // Then add to library with selected status
      await addToLibrary({
        mediaItemId: mediaId,
        watchStatus: status,
      });

      setAddedItems((prev) => new Set(prev).add(media.id));
      setActiveStatusPicker(null);
    } catch (error) {
      console.error("Failed to add to library:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Search</h1>
        <p className="text-neutral-400 mt-2">
          Find anime and manga to add to your library
        </p>
      </div>

      {/* Search bar */}
      <div className="space-y-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input
              type="text"
              placeholder="Search for anime or manga..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="pl-10 bg-neutral-900 border-neutral-800"
            />
          </div>
          <Button onClick={() => handleSearch()} disabled={loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* Filter buttons */}
        <div className="flex gap-2">
          {(["ALL", "ANIME", "MANGA"] as const).map((type) => (
            <Button
              key={type}
              variant={filter === type ? "default" : "outline"}
              onClick={() => setFilter(type)}
              size="sm"
            >
              {type}
            </Button>
          ))}
        </div>
      </div>

      {/* Results */}
      {results.length > 0 ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((media) => {
              const isAddedThisSession = addedItems.has(media.id);
              const isInLibrary = libraryIdsSet.has(media.id);
              const showInLibrary = isInLibrary || isAddedThisSession;

              return (
                <div
                  key={media.id}
                  className="bg-neutral-900 border border-neutral-800 overflow-hidden flex gap-4 p-4"
                >
                  {/* Cover image */}
                  <div className="w-24 h-36 bg-neutral-800 overflow-hidden flex-shrink-0">
                    <img
                      src={media.coverImage.large}
                      alt={media.title.romaji}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <h3 className="font-medium line-clamp-2">
                        {media.title.english || media.title.romaji}
                      </h3>
                      {media.title.english && (
                        <p className="text-sm text-neutral-400 line-clamp-1">
                          {media.title.romaji}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {media.type}
                      </Badge>
                      {media.format && (
                        <Badge variant="outline" className="text-xs">
                          {media.format}
                        </Badge>
                      )}
                      {media.status && (
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
                          <span className="text-neutral-400">
                            {media.averageScore}%
                          </span>
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
                        {showInLibrary ? (
                          <Badge className="bg-green-600 hover:bg-green-600 text-white cursor-default">
                            <Check className="w-3 h-3 mr-1" />
                            In Library
                          </Badge>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              onClick={() => setActiveStatusPicker(
                                activeStatusPicker === media.id ? null : media.id
                              )}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Add
                              <ChevronDown className="w-3 h-3 ml-1" />
                            </Button>
                            {activeStatusPicker === media.id && (
                              <StatusPicker
                                mediaType={media.type}
                                onSelect={(status) => handleAddToLibrary(media, status)}
                                onClose={() => setActiveStatusPicker(null)}
                              />
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Load More button */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="min-w-[200px]"
              >
                {loadingMore ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      ) : loading ? (
        <div className="text-center text-neutral-400 py-12">
          Searching...
        </div>
      ) : (
        <div className="text-center text-neutral-500 py-12">
          Search for anime or manga to get started
        </div>
      )}
    </div>
  );
}
