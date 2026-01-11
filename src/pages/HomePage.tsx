import { useMutation, useQuery } from "convex/react";
import { ChevronDown, Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { LibraryCard } from "@/components/LibraryCard";
import { LibraryGridSkeleton } from "@/components/LibraryCardSkeleton";
import { MediaDetailSheet } from "@/components/MediaDetailSheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type MediaType = "ANIME" | "MANGA";
type SortOption = "elo" | "recent" | "alphabetical" | "comparisons";

const STORAGE_KEY = "curator-library-tab";

export function HomePage() {
  const library = useQuery((api as any).library?.getByElo);
  const removeFromLibrary = useMutation((api as any).library.removeFromLibrary);
  const updateLibraryItem = useMutation(api.library.updateLibraryItem);

  const [activeTab, setActiveTab] = useState<MediaType>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "ANIME" || stored === "MANGA") {
        return stored;
      }
    }
    return "ANIME";
  });

  const [sortBy, setSortBy] = useState<SortOption>("elo");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [selectedItemId, setSelectedItemId] =
    useState<Id<"userLibrary"> | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on tab change
  useEffect(() => {
    setSelectedGenres([]);
  }, [activeTab]);

  const filteredByType = useMemo(() => {
    if (!library) return { anime: [], manga: [] };
    return {
      anime: library.filter((item: any) => item.mediaType === "ANIME"),
      manga: library.filter((item: any) => item.mediaType === "MANGA"),
    };
  }, [library]);

  const currentTabItems =
    activeTab === "ANIME" ? filteredByType.anime : filteredByType.manga;

  const availableGenres = useMemo(() => {
    const genreSet = new Set<string>();
    currentTabItems.forEach((item: any) => {
      item.mediaGenres?.forEach((genre: string) => {
        genreSet.add(genre);
      });
    });
    return Array.from(genreSet).sort();
  }, [currentTabItems]);

  const filteredByGenre = useMemo(() => {
    if (selectedGenres.length === 0) return currentTabItems;
    return currentTabItems.filter((item: any) =>
      selectedGenres.some((genre) => item.mediaGenres?.includes(genre)),
    );
  }, [currentTabItems, selectedGenres]);

  const eloRankMap = useMemo(() => {
    const sortedByElo = [...currentTabItems].sort(
      (a: any, b: any) => b.eloRating - a.eloRating,
    );
    const rankMap = new Map<string, number>();
    sortedByElo.forEach((item: any, index: number) => {
      rankMap.set(item._id, index + 1);
    });
    return rankMap;
  }, [currentTabItems]);

  const sortedItems = useMemo(() => {
    const items = [...filteredByGenre];
    switch (sortBy) {
      case "elo":
        return items.sort((a: any, b: any) => b.eloRating - a.eloRating);
      case "recent":
        return items.sort((a: any, b: any) => b.addedAt - a.addedAt);
      case "alphabetical":
        return items.sort((a: any, b: any) =>
          (a.mediaTitle || "").localeCompare(b.mediaTitle || ""),
        );
      case "comparisons":
        return items.sort(
          (a: any, b: any) => b.comparisonCount - a.comparisonCount,
        );
      default:
        return items;
    }
  }, [filteredByGenre, sortBy]);

  const toggleGenre = useCallback((genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre],
    );
  }, []);

  const clearGenres = useCallback(() => {
    setSelectedGenres([]);
  }, []);

  const openDetailSheet = useCallback((itemId: Id<"userLibrary">) => {
    setSelectedItemId(itemId);
    setDetailSheetOpen(true);
  }, []);

  const handleStatusChange = useCallback(
    (args: { id: string; watchStatus: string }) => {
      updateLibraryItem({
        id: args.id as Id<"userLibrary">,
        watchStatus: args.watchStatus as any,
      });
    },
    [updateLibraryItem],
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Library</h1>
        <p className="text-neutral-400 mt-2">
          Your anime and manga collection, ranked by preference
        </p>
      </div>

      <div className="flex gap-1 border-b border-neutral-800">
        <button
          type="button"
          onClick={() => setActiveTab("ANIME")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === "ANIME"
              ? "text-white"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Anime ({filteredByType.anime.length})
          {activeTab === "ANIME" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("MANGA")}
          className={`px-4 py-2 text-sm font-medium transition-colors relative ${
            activeTab === "MANGA"
              ? "text-white"
              : "text-neutral-400 hover:text-neutral-200"
          }`}
        >
          Manga ({filteredByType.manga.length})
          {activeTab === "MANGA" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
          )}
        </button>
      </div>

      <div className="space-y-3 md:space-y-0">
        <div className="flex flex-wrap gap-3 items-center">
          <Select
            value={sortBy}
            onValueChange={(v) => setSortBy(v as SortOption)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="elo">Elo Rank</SelectItem>
              <SelectItem value="recent">Recently Added</SelectItem>
              <SelectItem value="alphabetical">Alphabetical</SelectItem>
              <SelectItem value="comparisons">Comparison Count</SelectItem>
            </SelectContent>
          </Select>

          {availableGenres.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" className="gap-2">
                    <Filter className="size-4" />
                    Genres
                    {selectedGenres.length > 0 && (
                      <span className="bg-primary text-white px-1.5 py-0.5 text-xs ml-1">
                        {selectedGenres.length}
                      </span>
                    )}
                    <ChevronDown className="size-4 ml-1" />
                  </Button>
                }
              />
              <DropdownMenuContent className="max-h-[300px] overflow-y-auto w-[200px]">
                {selectedGenres.length > 0 && (
                  <button
                    type="button"
                    onClick={clearGenres}
                    className="w-full px-2 py-2 text-xs text-left text-primary hover:bg-neutral-800"
                  >
                    Clear all filters
                  </button>
                )}
                {availableGenres.map((genre) => (
                  <DropdownMenuCheckboxItem
                    key={genre}
                    checked={selectedGenres.includes(genre)}
                    onCheckedChange={() => toggleGenre(genre)}
                  >
                    {genre}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {selectedGenres.length > 0 && (
            <div className="hidden md:flex flex-wrap gap-1">
              {selectedGenres.map((genre) => (
                <button
                  type="button"
                  key={genre}
                  onClick={() => toggleGenre(genre)}
                  className="text-xs bg-primary/20 text-primary px-2 py-1 hover:bg-primary/30 transition-colors"
                >
                  {genre} &times;
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedGenres.length > 0 && (
          <div className="flex md:hidden flex-wrap gap-1">
            {selectedGenres.map((genre) => (
              <button
                type="button"
                key={genre}
                onClick={() => toggleGenre(genre)}
                className="text-xs bg-primary/20 text-primary px-2 py-1 hover:bg-primary/30 transition-colors"
              >
                {genre} &times;
              </button>
            ))}
          </div>
        )}
      </div>

      {library === undefined ? (
        <LibraryGridSkeleton count={10} />
      ) : currentTabItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 mb-4">
            No {activeTab.toLowerCase()} in your library yet
          </p>
          <p className="text-sm text-neutral-500">
            Add some {activeTab.toLowerCase()} from the Search tab to get
            started!
          </p>
        </div>
      ) : sortedItems.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 mb-4">No items match your filters</p>
          <button
            type="button"
            onClick={clearGenres}
            className="text-sm text-primary hover:text-primary/80"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <>
          {currentTabItems.length < 5 && (
            <div className="text-xs text-neutral-500 bg-neutral-900 p-3 border border-neutral-800">
              Add {5 - currentTabItems.length} more {activeTab.toLowerCase()} to
              see ranking scores. Scores require at least 5 items.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {sortedItems.map((item: any, index: number) => (
              <LibraryCard
                key={item._id}
                item={item}
                rank={
                  sortBy === "elo" ? index + 1 : (eloRankMap.get(item._id) ?? 0)
                }
                totalItems={currentTabItems.length}
                onRemove={removeFromLibrary}
                onStatusChange={handleStatusChange}
                onClick={() => openDetailSheet(item._id)}
              />
            ))}
          </div>
        </>
      )}

      <MediaDetailSheet
        libraryItemId={selectedItemId}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
      />
    </div>
  );
}
