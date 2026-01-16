import {
  Authenticated,
  Unauthenticated,
  useMutation,
  useQuery,
} from "convex/react";
import { ChevronDown, Filter, GitCompare } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { WelcomeScreen } from "@/components/WelcomeScreen";
import { RD_CONFIDENCE_THRESHOLD } from "@/lib/constants";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

type MediaType = "ANIME" | "MANGA";
type SortOption = "elo" | "recent" | "alphabetical" | "comparisons";

const STORAGE_KEY = "honmei-library-tab";

export function HomePage() {
  const library = useQuery((api as any).library?.getByRating);
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

  const { rankedItems, unrankedItems } = useMemo(() => {
    const ranked = currentTabItems.filter(
      (item: any) => item.rd <= RD_CONFIDENCE_THRESHOLD,
    );
    const unranked = currentTabItems.filter(
      (item: any) => item.rd > RD_CONFIDENCE_THRESHOLD,
    );
    return { rankedItems: ranked, unrankedItems: unranked };
  }, [currentTabItems]);

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
    if (selectedGenres.length === 0)
      return { ranked: rankedItems, unranked: unrankedItems };
    const filterFn = (item: any) =>
      selectedGenres.some((genre) => item.mediaGenres?.includes(genre));
    return {
      ranked: rankedItems.filter(filterFn),
      unranked: unrankedItems.filter(filterFn),
    };
  }, [rankedItems, unrankedItems, selectedGenres]);

  const ratingRankMap = useMemo(() => {
    const sortedByRating = [...rankedItems].sort(
      (a: any, b: any) => b.rating - a.rating,
    );
    const rankMap = new Map<string, number>();
    sortedByRating.forEach((item: any, index: number) => {
      rankMap.set(item._id, index + 1);
    });
    return rankMap;
  }, [rankedItems]);

  const sortItems = useCallback(
    (items: any[]) => {
      const sorted = [...items];
      switch (sortBy) {
        case "elo":
          return sorted.sort((a: any, b: any) => b.rating - a.rating);
        case "recent":
          return sorted.sort((a: any, b: any) => b.addedAt - a.addedAt);
        case "alphabetical":
          return sorted.sort((a: any, b: any) =>
            (a.mediaTitle || "").localeCompare(b.mediaTitle || ""),
          );
        case "comparisons":
          return sorted.sort(
            (a: any, b: any) => b.comparisonCount - a.comparisonCount,
          );
        default:
          return sorted;
      }
    },
    [sortBy],
  );

  const sortedRankedItems = useMemo(
    () => sortItems(filteredByGenre.ranked),
    [sortItems, filteredByGenre.ranked],
  );

  const sortedUnrankedItems = useMemo(() => {
    const items = [...filteredByGenre.unranked];
    // Always sort unranked by RD ascending (closest to ranked first)
    return items.sort((a: any, b: any) => a.rd - b.rd);
  }, [filteredByGenre.unranked]);

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

  const totalItems = currentTabItems.length;
  const hasUnrankedItems = unrankedItems.length > 0;
  const hasNoResults =
    sortedRankedItems.length === 0 && sortedUnrankedItems.length === 0;

  return (
    <>
      <Unauthenticated>
        <WelcomeScreen />
      </Unauthenticated>
      <Authenticated>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">My Library</h1>
            <p className="text-foreground-muted mt-2">
              Your anime and manga collection, ranked by preference
            </p>
          </div>

          <div className="flex gap-1 border-b border-border">
            <button
              type="button"
              onClick={() => setActiveTab("ANIME")}
              className={`px-4 py-2 text-sm font-medium transition-colors relative ${
                activeTab === "ANIME"
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground"
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
                  ? "text-foreground"
                  : "text-foreground-muted hover:text-foreground"
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
                          <span className="bg-primary text-primary-foreground px-1.5 py-0.5 text-xs ml-1">
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
                        className="w-full px-2 py-2 text-xs text-left text-primary hover:bg-surface-raised"
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

          {hasUnrankedItems && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground-muted">
                <span className="font-medium text-foreground">
                  {unrankedItems.length}
                </span>{" "}
                {unrankedItems.length === 1 ? "item needs" : "items need"} more
                comparisons
              </p>
              <Link to="/compare">
                <Button variant="outline" size="sm" className="gap-1.5">
                  <GitCompare className="size-3.5" />
                  Compare
                </Button>
              </Link>
            </div>
          )}

          {library === undefined ? (
            <LibraryGridSkeleton count={10} />
          ) : totalItems === 0 ? (
            <div className="text-center py-12">
              <p className="text-foreground-muted mb-4">
                No {activeTab.toLowerCase()} in your library yet
              </p>
              <p className="text-sm text-foreground-subtle">
                Add some {activeTab.toLowerCase()} from the Search tab to get
                started!
              </p>
            </div>
          ) : hasNoResults ? (
            <div className="text-center py-12">
              <p className="text-foreground-muted mb-4">
                No items match your filters
              </p>
              <button
                type="button"
                onClick={clearGenres}
                className="text-sm text-primary hover:text-primary/80"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {totalItems < 5 && (
                <div className="text-xs text-foreground-subtle bg-surface p-3 border border-border">
                  Add {5 - totalItems} more {activeTab.toLowerCase()} to see
                  ranking scores. Scores require at least 5 items.
                </div>
              )}

              {sortedRankedItems.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sortedRankedItems.map((item: any, index: number) => (
                    <LibraryCard
                      key={item._id}
                      item={item}
                      rank={
                        sortBy === "elo"
                          ? index + 1
                          : (ratingRankMap.get(item._id) ?? 0)
                      }
                      totalItems={rankedItems.length}
                      onRemove={removeFromLibrary}
                      onStatusChange={handleStatusChange}
                      onClick={() => openDetailSheet(item._id)}
                    />
                  ))}
                </div>
              )}

              {sortedUnrankedItems.length > 0 && (
                <>
                  {sortedRankedItems.length > 0 && (
                    <hr className="border-border/50" />
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {sortedUnrankedItems.map((item: any) => (
                      <LibraryCard
                        key={item._id}
                        item={item}
                        totalItems={rankedItems.length}
                        onRemove={removeFromLibrary}
                        onStatusChange={handleStatusChange}
                        onClick={() => openDetailSheet(item._id)}
                        isUnranked
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <MediaDetailSheet
            libraryItemId={selectedItemId}
            open={detailSheetOpen}
            onOpenChange={setDetailSheetOpen}
          />
        </div>
      </Authenticated>
    </>
  );
}
