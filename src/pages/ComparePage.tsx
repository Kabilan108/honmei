import { useMutation, useQuery } from "convex/react";
import {
  ChevronRight,
  Flame,
  Scale,
  SkipForward,
  Target,
  Undo2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { ComparisonCard } from "@/components/ComparisonCard";
import { ComparisonPairSkeleton } from "@/components/ComparisonCardSkeleton";
import { StatsModalContent, StatsPanel } from "@/components/StatsPanel";
import { Button } from "@/components/ui/button";
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
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

const RESULT_DISPLAY_MS = 1000;
const MOBILE_BREAKPOINT = 768;

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined"
      ? window.innerWidth < MOBILE_BREAKPOINT
      : false,
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return isMobile;
}

function InlineStats({ onViewAll }: { onViewAll: () => void }) {
  const stats = useQuery((api as any).stats?.getAggregatedStats);

  if (!stats) {
    return (
      <div className="text-center text-sm text-foreground-subtle">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-4 text-sm">
      <span className="flex items-center gap-1.5 text-foreground-muted">
        <Target className="size-3.5" />
        <span className="tabular-nums">
          {stats.totalComparisons.toLocaleString()}
        </span>
      </span>
      {stats.streak > 0 && (
        <span className="flex items-center gap-1.5 text-foreground-muted">
          <Flame className="size-3.5 text-orange-400" />
          <span className="tabular-nums">{stats.streak}</span> days
        </span>
      )}
      <button
        type="button"
        onClick={onViewAll}
        className="flex items-center gap-0.5 text-primary hover:text-primary/80 transition-colors"
      >
        Stats
        <ChevronRight className="size-3.5" />
      </button>
    </div>
  );
}

function StatsRow() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={setOpen}>
        <InlineStats onViewAll={() => setOpen(true)} />
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Your Stats</DrawerTitle>
          </DrawerHeader>
          <div className="p-6 pt-2">
            <StatsModalContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <InlineStats onViewAll={() => setOpen(true)} />
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Your Stats</DialogTitle>
        </DialogHeader>
        <StatsModalContent />
      </DialogContent>
    </Dialog>
  );
}

type MediaType = "ANIME" | "MANGA";
type SkippedPair = [Id<"userLibrary">, Id<"userLibrary">];

type ComparisonResult = {
  winnerId: string;
  winnerOld: number;
  winnerNew: number;
  loserOld: number;
  loserNew: number;
};

interface FrozenItem {
  _id: string;
  rating: number;
  rd: number;
  comparisonCount: number;
  mediaTitle: string;
  mediaCoverImage: string;
  mediaBannerImage?: string;
  mediaType: "ANIME" | "MANGA";
  mediaGenres: string[];
}

type FrozenPair = {
  item1: FrozenItem;
  item2: FrozenItem;
};

type UndoData = {
  comparisonId: Id<"comparisons">;
  item1Id: Id<"userLibrary">;
  item2Id: Id<"userLibrary">;
  isTie: boolean;
  item1Old: { rating: number; rd: number; volatility: number };
  item2Old: { rating: number; rd: number; volatility: number };
  item1OldCompCount: number;
  item2OldCompCount: number;
  item1OldWins?: number;
  item1OldLosses?: number;
  item1OldTies?: number;
  item2OldWins?: number;
  item2OldLosses?: number;
  item2OldTies?: number;
};

export function ComparePage() {
  const isMobile = useIsMobile();
  const [mediaType, setMediaType] = useState<MediaType>("ANIME");
  const [isComparing, setIsComparing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [skippedPairs, setSkippedPairs] = useState<SkippedPair[]>([]);
  const [frozenPair, setFrozenPair] = useState<FrozenPair | null>(null);
  const [lastResult, setLastResult] = useState<ComparisonResult | null>(null);
  const [undoData, setUndoData] = useState<UndoData | null>(null);
  const [isUndoing, setIsUndoing] = useState(false);

  const result = useQuery((api as any).ranking?.getSmartPairWithStats, {
    mediaType,
    skippedPairs,
  });
  const pair = result?.pair;
  const stats = result?.stats;
  const recordComparison = useMutation(
    (api as any).comparisons?.recordComparison,
  );
  const recordTie = useMutation((api as any).comparisons?.recordTie);
  const undoComparisonMutation = useMutation(
    (api as any).comparisons?.undoComparison,
  );

  // Reset session state when switching media type
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional reset on mediaType change
  useEffect(() => {
    setShowResults(false);
    setLastResult(null);
    setSkippedPairs([]);
    setFrozenPair(null);
    setUndoData(null);
  }, [mediaType]);

  const handleChoice = async (winnerId: string, loserId: string) => {
    if (!pair) return;
    setIsComparing(true);

    const winner = winnerId === pair.item1._id ? pair.item1 : pair.item2;
    const loser = loserId === pair.item1._id ? pair.item1 : pair.item2;

    setFrozenPair({
      item1: { ...pair.item1 },
      item2: { ...pair.item2 },
    });

    try {
      const result = await recordComparison({
        winnerId: winnerId as any,
        loserId: loserId as any,
      });
      setLastResult({
        winnerId,
        winnerOld: winner.rating,
        winnerNew: result.winnerNew,
        loserOld: loser.rating,
        loserNew: result.loserNew,
      });
      setUndoData({
        comparisonId: result.comparisonId,
        item1Id: winnerId as Id<"userLibrary">,
        item2Id: loserId as Id<"userLibrary">,
        isTie: false,
        item1Old: result.undoData.winnerOld,
        item2Old: result.undoData.loserOld,
        item1OldCompCount: result.undoData.winnerOldCompCount,
        item2OldCompCount: result.undoData.loserOldCompCount,
        item1OldWins: result.undoData.winnerOldWins,
        item2OldLosses: result.undoData.loserOldLosses,
      });
      setShowResults(true);
    } catch (error) {
      console.error("Failed to record comparison:", error);
      setFrozenPair(null);
    } finally {
      setIsComparing(false);
    }
  };

  // Auto-advance to next pair after showing results
  useEffect(() => {
    if (!showResults) return;

    const timer = setTimeout(() => {
      setShowResults(false);
      setLastResult(null);
      setFrozenPair(null);
    }, RESULT_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, [showResults]);

  const handleTie = async () => {
    if (!pair) return;
    setIsComparing(true);

    setFrozenPair({
      item1: { ...pair.item1 },
      item2: { ...pair.item2 },
    });

    try {
      const result = await recordTie({
        item1Id: pair.item1._id as any,
        item2Id: pair.item2._id as any,
      });
      setLastResult({
        winnerId: "",
        winnerOld: pair.item1.rating,
        winnerNew: result.item1Rating,
        loserOld: pair.item2.rating,
        loserNew: result.item2Rating,
      });
      setUndoData({
        comparisonId: result.comparisonId,
        item1Id: pair.item1._id as Id<"userLibrary">,
        item2Id: pair.item2._id as Id<"userLibrary">,
        isTie: true,
        item1Old: result.undoData.item1Old,
        item2Old: result.undoData.item2Old,
        item1OldCompCount: result.undoData.item1OldCompCount,
        item2OldCompCount: result.undoData.item2OldCompCount,
        item1OldTies: result.undoData.item1OldTies,
        item2OldTies: result.undoData.item2OldTies,
      });
      setShowResults(true);
    } catch (error) {
      console.error("Failed to record tie:", error);
      setFrozenPair(null);
    } finally {
      setIsComparing(false);
    }
  };

  const handleSkip = () => {
    if (pair) {
      setSkippedPairs((prev) => [...prev, [pair.item1._id, pair.item2._id]]);
    }
    setShowResults(false);
    setLastResult(null);
    setFrozenPair(null);
    setUndoData(null);
  };

  const handleUndo = async () => {
    if (!undoData || isUndoing) return;
    setIsUndoing(true);

    try {
      await undoComparisonMutation({
        comparisonId: undoData.comparisonId,
        item1Id: undoData.item1Id,
        item2Id: undoData.item2Id,
        isTie: undoData.isTie,
        item1Old: undoData.item1Old,
        item2Old: undoData.item2Old,
        item1OldCompCount: undoData.item1OldCompCount,
        item2OldCompCount: undoData.item2OldCompCount,
        item1OldWins: undoData.item1OldWins,
        item1OldLosses: undoData.item1OldLosses,
        item1OldTies: undoData.item1OldTies,
        item2OldWins: undoData.item2OldWins,
        item2OldLosses: undoData.item2OldLosses,
        item2OldTies: undoData.item2OldTies,
      });
      setUndoData(null);
    } catch (error) {
      console.error("Failed to undo comparison:", error);
    } finally {
      setIsUndoing(false);
    }
  };

  if (result === undefined) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="text-center">
          <h1 className="text-3xl font-bold">Compare</h1>
          <p className="text-foreground-muted mt-2">Which one do you prefer?</p>
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
          <p className="text-foreground-muted mt-2">
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

        <div className="text-center py-12 space-y-4 bg-surface border border-border">
          {stats && stats.totalItems < 2 ? (
            <>
              <Scale className="size-12 mx-auto text-foreground-subtle" />
              <h2 className="text-xl font-bold">Not enough items</h2>
              <p className="text-foreground-muted max-w-md mx-auto">
                Add at least 2 {mediaType.toLowerCase()} to your library to
                start comparing.
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl mb-2">🎉</div>
              <h2 className="text-xl font-bold">All caught up!</h2>
              <p className="text-foreground-muted max-w-md mx-auto">
                All your {mediaType.toLowerCase()} are well-ranked. Add more
                items or check back later as rankings naturally decay over time.
              </p>
              {skippedPairs.length > 0 && (
                <Button
                  variant="outline"
                  onClick={() => setSkippedPairs([])}
                  size="sm"
                  className="mt-4"
                >
                  Review skipped pairs
                </Button>
              )}
            </>
          )}
        </div>

        <StatsPanel />
      </div>
    );
  }

  const displayPair = frozenPair ?? pair;
  const { item1, item2 } = displayPair;

  const getRatingDisplay = (itemId: string, isItem1: boolean) => {
    if (!showResults || !lastResult) {
      const currentItem = isItem1 ? item1 : item2;
      return (
        <span className="text-primary">{Math.round(currentItem.rating)}</span>
      );
    }

    const isTie = lastResult.winnerId === "";
    const isWinner = lastResult.winnerId === itemId;

    let oldRating: number;
    let newRating: number;

    if (isTie) {
      oldRating = isItem1 ? lastResult.winnerOld : lastResult.loserOld;
      newRating = isItem1 ? lastResult.winnerNew : lastResult.loserNew;
    } else if (isWinner) {
      oldRating = lastResult.winnerOld;
      newRating = lastResult.winnerNew;
    } else {
      oldRating = lastResult.loserOld;
      newRating = lastResult.loserNew;
    }

    const diff = Math.round(newRating - oldRating);

    return (
      <div className="flex items-center gap-2 animate-in fade-in duration-300">
        <span className="text-primary font-semibold">
          {Math.round(newRating)}
        </span>
        <span
          className={`text-sm font-medium ${
            diff > 0
              ? "text-green-400"
              : diff < 0
                ? "text-red-400"
                : "text-foreground-muted"
          }`}
        >
          {diff > 0 ? `+${diff}` : diff === 0 ? "±0" : diff}
        </span>
      </div>
    );
  };

  const getResultState = (
    itemId: string,
  ): "winner" | "loser" | "tie" | null => {
    if (!showResults || !lastResult) return null;

    if (lastResult.winnerId === "") {
      return "tie";
    }
    return lastResult.winnerId === itemId ? "winner" : "loser";
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="text-foreground-muted mt-2">Which one do you prefer?</p>
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

      <div className="grid grid-cols-2 gap-2 md:gap-4 relative py-4 md:py-0">
        <ComparisonCard
          item={item1}
          ratingDisplay={getRatingDisplay(item1._id, true)}
          disabled={isComparing || showResults}
          onClick={() => handleChoice(item1._id, item2._id)}
          resultState={getResultState(item1._id)}
          compact={isMobile}
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none md:hidden">
          <div className="w-8 h-8 rounded-full bg-surface border-2 border-border flex items-center justify-center shadow-lg">
            <span className="text-[10px] font-bold text-foreground-muted tracking-tight">
              VS
            </span>
          </div>
        </div>
        <ComparisonCard
          item={item2}
          ratingDisplay={getRatingDisplay(item2._id, false)}
          disabled={isComparing || showResults}
          onClick={() => handleChoice(item2._id, item1._id)}
          resultState={getResultState(item2._id)}
          compact={isMobile}
        />
      </div>

      <div className="flex items-center justify-center gap-4">
        <Button
          variant="ghost"
          onClick={handleUndo}
          disabled={!undoData || showResults || isComparing || isUndoing}
          className="gap-2 text-foreground-muted"
        >
          <Undo2 className="size-4" />
          Undo
        </Button>
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
          disabled={isComparing || showResults}
          className="gap-2 text-foreground-muted"
        >
          <SkipForward className="size-4" />
          Skip
        </Button>
      </div>

      <StatsRow />
    </div>
  );
}
