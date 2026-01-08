import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function ComparePage() {
  const pair = useQuery((api as any).comparisons?.getRandomPair);
  const recordComparison = useMutation((api as any).comparisons?.recordComparison);
  const [isComparing, setIsComparing] = useState(false);

  const handleChoice = async (winnerId: string, loserId: string) => {
    setIsComparing(true);
    try {
      await recordComparison({
        winnerId: winnerId as any,
        loserId: loserId as any,
      });
      // The query will automatically refetch a new pair
    } catch (error) {
      console.error("Failed to record comparison:", error);
    } finally {
      setIsComparing(false);
    }
  };

  if (pair === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (!pair || !pair.item1 || !pair.item2) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Not enough items</h2>
          <p className="text-neutral-400">
            Add at least 2 items to your library to start comparing
          </p>
        </div>
      </div>
    );
  }

  const { item1, item2 } = pair;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="text-neutral-400 mt-2">
          Which one do you prefer? Choose to refine your rankings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Item 1 */}
        <button
          onClick={() => handleChoice(item1._id, item2._id)}
          disabled={isComparing}
          className="bg-neutral-900 border-2 border-neutral-800 rounded-lg overflow-hidden hover:border-blue-500 transition-all disabled:opacity-50 text-left"
        >
          {/* Banner or cover */}
          <div className="aspect-video bg-neutral-800 relative overflow-hidden">
            {item1.media?.bannerImage ? (
              <img
                src={item1.media.bannerImage}
                alt={item1.media.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item1.media?.coverImage}
                alt={item1.media?.title}
                className="w-full h-full object-cover blur-lg scale-110"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
          </div>

          <div className="p-6 space-y-4">
            {/* Cover and title */}
            <div className="flex gap-4">
              <div className="w-20 h-28 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
                {item1.media?.coverImage && (
                  <img
                    src={item1.media.coverImage}
                    alt={item1.media.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold mb-2 line-clamp-2">
                  {item1.media?.title}
                </h3>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {item1.media?.type}
                  </Badge>
                  {item1.media?.format && (
                    <Badge variant="outline" className="text-xs">
                      {item1.media.format}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <div className="text-neutral-400">Current Rating</div>
                <div className="text-2xl font-bold font-mono text-blue-400">
                  {item1.eloRating}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-neutral-400">Comparisons</div>
                <div className="text-lg font-medium">{item1.comparisonCount}</div>
              </div>
            </div>

            {/* Genres */}
            {item1.media?.genres && item1.media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item1.media.genres.slice(0, 4).map((genre: string) => (
                  <span
                    key={genre}
                    className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>

        {/* Item 2 */}
        <button
          onClick={() => handleChoice(item2._id, item1._id)}
          disabled={isComparing}
          className="bg-neutral-900 border-2 border-neutral-800 rounded-lg overflow-hidden hover:border-blue-500 transition-all disabled:opacity-50 text-left"
        >
          {/* Banner or cover */}
          <div className="aspect-video bg-neutral-800 relative overflow-hidden">
            {item2.media?.bannerImage ? (
              <img
                src={item2.media.bannerImage}
                alt={item2.media.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <img
                src={item2.media?.coverImage}
                alt={item2.media?.title}
                className="w-full h-full object-cover blur-lg scale-110"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-neutral-900 via-transparent to-transparent" />
          </div>

          <div className="p-6 space-y-4">
            {/* Cover and title */}
            <div className="flex gap-4">
              <div className="w-20 h-28 bg-neutral-800 rounded overflow-hidden flex-shrink-0">
                {item2.media?.coverImage && (
                  <img
                    src={item2.media.coverImage}
                    alt={item2.media.title}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold mb-2 line-clamp-2">
                  {item2.media?.title}
                </h3>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    {item2.media?.type}
                  </Badge>
                  {item2.media?.format && (
                    <Badge variant="outline" className="text-xs">
                      {item2.media.format}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <div className="text-neutral-400">Current Rating</div>
                <div className="text-2xl font-bold font-mono text-blue-400">
                  {item2.eloRating}
                </div>
              </div>
              <div className="text-right space-y-1">
                <div className="text-neutral-400">Comparisons</div>
                <div className="text-lg font-medium">{item2.comparisonCount}</div>
              </div>
            </div>

            {/* Genres */}
            {item2.media?.genres && item2.media.genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {item2.media.genres.slice(0, 4).map((genre: string) => (
                  <span
                    key={genre}
                    className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1 rounded"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      </div>

      <div className="text-center text-sm text-neutral-500">
        Tap either card to choose your preference
      </div>
    </div>
  );
}
