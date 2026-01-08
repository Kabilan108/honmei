import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Scale, SkipForward, BarChart3, RefreshCw } from "lucide-react";
import { StatsPanel } from "@/components/StatsPanel";

const SESSION_LIMIT = 5;

type MediaType = "ANIME" | "MANGA";

export function ComparePage() {
  const [mediaType, setMediaType] = useState<MediaType>("ANIME");
  const [sessionCount, setSessionCount] = useState(0);
  const [isComparing, setIsComparing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [lastResult, setLastResult] = useState<{
    winnerId: string;
    winnerNew: number;
    loserNew: number;
  } | null>(null);

  const pair = useQuery((api as any).ranking?.getSmartPair, { mediaType });
  const stats = useQuery((api as any).ranking?.getRankingStats, { mediaType });
  const dueComparisons = useQuery((api as any).ranking?.getDueComparisons);
  const recordComparison = useMutation((api as any).comparisons?.recordComparison);
  const recordTie = useMutation((api as any).comparisons?.recordTie);

  // Reset session count when switching media type
  useEffect(() => {
    setSessionCount(0);
    setShowResults(false);
    setLastResult(null);
  }, [mediaType]);

  const handleChoice = async (winnerId: string, loserId: string) => {
    setIsComparing(true);
    try {
      const result = await recordComparison({
        winnerId: winnerId as any,
        loserId: loserId as any,
      });
      setLastResult({ winnerId, ...result });
      setShowResults(true);
      setSessionCount((prev) => prev + 1);

      // Auto-hide results after 2 seconds
      setTimeout(() => {
        setShowResults(false);
        setLastResult(null);
      }, 2000);
    } catch (error) {
      console.error("Failed to record comparison:", error);
    } finally {
      setIsComparing(false);
    }
  };

  const handleTie = async () => {
    if (!pair) return;
    setIsComparing(true);
    try {
      await recordTie({
        item1Id: pair.item1._id as any,
        item2Id: pair.item2._id as any,
      });
      setSessionCount((prev) => prev + 1);
    } catch (error) {
      console.error("Failed to record tie:", error);
    } finally {
      setIsComparing(false);
    }
  };

  const handleSkip = () => {
    // Just triggers a re-render to get a new pair
    // We could add skip tracking later
    setShowResults(false);
    setLastResult(null);
  };

  // Session complete
  if (sessionCount >= SESSION_LIMIT) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center py-8 space-y-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-neutral-400">
            You've made {SESSION_LIMIT} comparisons. Take a break or continue refining.
          </p>
          <div className="flex gap-4 justify-center pt-4">
            <Button
              variant="outline"
              onClick={() => setSessionCount(0)}
              className="gap-2"
            >
              <RefreshCw className="size-4" />
              Continue Comparing
            </Button>
          </div>
        </div>

        <StatsPanel />
      </div>
    );
  }

  if (pair === undefined) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  // Not enough items or no comparisons needed
  if (!pair || !pair.item1 || !pair.item2) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-neutral-400 mt-2">
            Refine your rankings through comparisons
          </p>
        </div>

        {/* Media type tabs */}
        <div className="flex gap-2 justify-center">
          {(["ANIME", "MANGA"] as const).map((type) => (
            <Button
              key={type}
              variant={mediaType === type ? "default" : "outline"}
              onClick={() => setMediaType(type)}
              size="sm"
            >
              {type}
            </Button>
          ))}
        </div>

        <div className="text-center py-12 space-y-4 bg-neutral-900 border border-neutral-800">
          <Scale className="size-12 mx-auto text-neutral-600" />
          <h2 className="text-xl font-bold">No comparisons available</h2>
          <p className="text-neutral-400 max-w-md mx-auto">
            {stats && stats.totalItems < 2
              ? `Add at least 2 ${mediaType.toLowerCase()} to your library to start comparing.`
              : `All ${mediaType.toLowerCase()} are well-ranked! Check back later or add more items.`}
          </p>
        </div>

        <StatsPanel />
      </div>
    );
  }

  const { item1, item2 } = pair;

  // Helper to get rating display
  const getRatingDisplay = (itemId: string, itemRating: number) => {
    if (!showResults || !lastResult) {
      return <span className="text-neutral-500">???</span>;
    }
    const isWinner = lastResult.winnerId === itemId;
    const newRating = isWinner ? lastResult.winnerNew : lastResult.loserNew;
    const diff = newRating - itemRating;
    return (
      <div className="flex items-center gap-2">
        <span className="text-blue-400">{newRating}</span>
        <span className={diff >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"}>
          {diff >= 0 ? `+${diff}` : diff}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="text-neutral-400 mt-2">
          Which one do you prefer?
        </p>
      </div>

      {/* Media type tabs */}
      <div className="flex gap-2 justify-center">
        {(["ANIME", "MANGA"] as const).map((type) => (
          <Button
            key={type}
            variant={mediaType === type ? "default" : "outline"}
            onClick={() => setMediaType(type)}
            size="sm"
          >
            {type}
          </Button>
        ))}
      </div>

      {/* Session progress */}
      <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
        <span>Comparison {sessionCount + 1} of {SESSION_LIMIT}</span>
        <div className="flex gap-1">
          {Array.from({ length: SESSION_LIMIT }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 ${i < sessionCount ? "bg-blue-500" : "bg-neutral-700"}`}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Item 1 */}
        <button
          onClick={() => handleChoice(item1._id, item2._id)}
          disabled={isComparing || showResults}
          className="bg-neutral-900 border-2 border-neutral-800 overflow-hidden hover:border-blue-500 transition-all disabled:opacity-50 text-left focus:outline-none focus:border-blue-500"
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
              <div className="w-20 h-28 bg-neutral-800 overflow-hidden flex-shrink-0">
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

            {/* Stats - hidden until choice */}
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <div className="text-neutral-400">Rating</div>
                <div className="text-2xl font-bold font-mono">
                  {getRatingDisplay(item1._id, item1.eloRating)}
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
                    className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1"
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
          disabled={isComparing || showResults}
          className="bg-neutral-900 border-2 border-neutral-800 overflow-hidden hover:border-blue-500 transition-all disabled:opacity-50 text-left focus:outline-none focus:border-blue-500"
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
              <div className="w-20 h-28 bg-neutral-800 overflow-hidden flex-shrink-0">
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

            {/* Stats - hidden until choice */}
            <div className="flex items-center justify-between text-sm">
              <div className="space-y-1">
                <div className="text-neutral-400">Rating</div>
                <div className="text-2xl font-bold font-mono">
                  {getRatingDisplay(item2._id, item2.eloRating)}
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
                    className="text-xs text-neutral-500 bg-neutral-800 px-2 py-1"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          onClick={handleTie}
          disabled={isComparing || showResults}
          className="gap-2"
        >
          <Scale className="size-4" />
          Can't Decide
        </Button>
        <Button
          variant="ghost"
          onClick={handleSkip}
          disabled={isComparing}
          className="gap-2 text-neutral-400"
        >
          <SkipForward className="size-4" />
          Skip
        </Button>
      </div>

      <div className="text-center text-sm text-neutral-500">
        Tap a card to choose, or use the buttons below
      </div>
    </div>
  );
}
