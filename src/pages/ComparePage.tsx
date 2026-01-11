import { useMutation, useQuery } from "convex/react";
import { RefreshCw, Scale, SkipForward } from "lucide-react";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { ComparisonPairSkeleton } from "@/components/ComparisonCardSkeleton";
import { StatsPanel } from "@/components/StatsPanel";
import { Button } from "@/components/ui/button";
import { api } from "../../convex/_generated/api";

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

  const result = useQuery((api as any).ranking?.getSmartPairWithStats, {
    mediaType,
  });
  const pair = result?.pair;
  const stats = result?.stats;
  const recordComparison = useMutation(
    (api as any).comparisons?.recordComparison,
  );
  const recordTie = useMutation((api as any).comparisons?.recordTie);

  // Reset session count when switching media type
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on mediaType change
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
    setShowResults(false);
    setLastResult(null);
  };

  if (sessionCount >= SESSION_LIMIT) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center py-8 space-y-4">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold">Session Complete!</h2>
          <p className="text-neutral-400">
            You've made {SESSION_LIMIT} comparisons. Take a break or continue
            refining.
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

  if (result === undefined) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-neutral-400 mt-2">Which one do you prefer?</p>
        </div>
        <ComparisonPairSkeleton />
      </div>
    );
  }

  if (!pair || !pair.item1 || !pair.item2) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-neutral-400 mt-2">
            Refine your rankings through comparisons
          </p>
        </div>

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

  const getRatingDisplay = (itemId: string, itemRating: number) => {
    if (!showResults || !lastResult) {
      return <span className="text-neutral-500">???</span>;
    }
    const isWinner = lastResult.winnerId === itemId;
    const newRating = isWinner ? lastResult.winnerNew : lastResult.loserNew;
    const diff = newRating - itemRating;
    return (
      <div className="flex items-center gap-2">
        <span className="text-primary">{newRating}</span>
        <span
          className={
            diff >= 0 ? "text-green-400 text-sm" : "text-red-400 text-sm"
          }
        >
          {diff >= 0 ? `+${diff}` : diff}
        </span>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="text-neutral-400 mt-2">Which one do you prefer?</p>
      </div>

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

      <div className="flex items-center justify-center gap-2 text-sm text-neutral-400">
        <span>
          Comparison {sessionCount + 1} of {SESSION_LIMIT}
        </span>
        <div className="flex gap-1">
          {Array.from({ length: SESSION_LIMIT }).map((_, i) => {
            const dotId = `session-${i}`;
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-size progress indicator
              <div
                key={dotId}
                className={`w-2 h-2 ${i < sessionCount ? "bg-primary" : "bg-neutral-700"}`}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ComparisonCard
          item={item1}
          ratingDisplay={getRatingDisplay(item1._id, item1.eloRating)}
          disabled={isComparing || showResults}
          onClick={() => handleChoice(item1._id, item2._id)}
        />
        <ComparisonCard
          item={item2}
          ratingDisplay={getRatingDisplay(item2._id, item2.eloRating)}
          disabled={isComparing || showResults}
          onClick={() => handleChoice(item2._id, item1._id)}
        />
      </div>

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
