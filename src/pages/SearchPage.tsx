import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { searchAniList, type AniListMedia } from "@/lib/anilist";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Check } from "lucide-react";

export function SearchPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "ANIME" | "MANGA">("ALL");
  const [addedItems, setAddedItems] = useState<Set<number>>(new Set());

  const upsertMedia = useMutation((api as any).media?.upsertMediaItem);
  const addToLibrary = useMutation((api as any).library?.addToLibrary);

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;

    setLoading(true);
    try {
      const type = filter === "ALL" ? undefined : filter;
      const page = await searchAniList(searchTerm, type);
      setResults(page.media);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToLibrary = async (media: AniListMedia) => {
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
        startDate: media.startDate,
        endDate: media.endDate,
      });

      // Then add to library
      await addToLibrary({
        mediaItemId: mediaId,
        watchStatus: "PLAN_TO_WATCH",
      });

      setAddedItems((prev) => new Set(prev).add(media.id));
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
          <Button onClick={handleSearch} disabled={loading}>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {results.map((media) => {
            const isAdded = addedItems.has(media.id);

            return (
              <div
                key={media.id}
                className="bg-neutral-900 rounded-lg border border-neutral-800 overflow-hidden flex gap-4 p-4"
              >
                {/* Cover image */}
                <div className="w-24 h-36 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
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
                          className="text-xs text-neutral-500 bg-neutral-800 px-2 py-0.5 rounded"
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
                          ⭐ {media.averageScore}%
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

                    <Button
                      size="sm"
                      onClick={() => handleAddToLibrary(media)}
                      disabled={isAdded}
                    >
                      {isAdded ? (
                        <>
                          <Check className="w-4 h-4 mr-1" />
                          Added
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-1" />
                          Add
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
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
