import { useQuery } from "convex/react";
import { Calendar, Flame, Target, TrendingUp, Trophy } from "lucide-react";
import { api } from "../../convex/_generated/api";

interface ActivityBarProps {
  days: { day: string; count: number }[];
}

function ActivityBar({ days }: ActivityBarProps) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-foreground-muted text-xs font-medium uppercase tracking-wide">
        <Calendar className="size-3.5" />
        Last 7 Days
      </div>
      <div className="flex gap-2 items-end h-20">
        {days.map((day) => (
          <div
            key={day.day}
            className="flex-1 flex flex-col items-center gap-1.5"
          >
            <div
              className="w-full bg-primary/70 rounded-sm transition-all hover:bg-primary"
              style={{
                height: `${(day.count / maxCount) * 100}%`,
                minHeight: day.count > 0 ? "6px" : "2px",
              }}
            />
            <span className="text-[11px] text-foreground-subtle font-medium">
              {day.day}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsModalContent() {
  const stats = useQuery((api as any).stats?.getAggregatedStats);

  if (!stats) {
    return (
      <div className="py-8 text-center text-foreground-muted">
        Loading stats...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-x-8 gap-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground-muted text-xs font-medium uppercase tracking-wide">
            <Target className="size-3.5" />
            Total Comparisons
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {stats.totalComparisons.toLocaleString()}
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground-muted text-xs font-medium uppercase tracking-wide">
            <Flame className="size-3.5 text-orange-400" />
            Current Streak
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {stats.streak}{" "}
            <span className="text-lg font-normal text-foreground-muted">
              day{stats.streak !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="text-xs text-foreground-subtle">
            Best: {stats.longestStreak} days
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground-muted text-xs font-medium uppercase tracking-wide">
            <Trophy className="size-3.5" />
            Library Size
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {stats.totalItems}
          </div>
          <div className="text-xs text-foreground-subtle">
            {stats.animeCount} anime · {stats.mangaCount} manga
          </div>
        </div>

        <div className="space-y-1">
          <div className="flex items-center gap-2 text-foreground-muted text-xs font-medium uppercase tracking-wide">
            <TrendingUp className="size-3.5" />
            Today
          </div>
          <div className="text-3xl font-bold tabular-nums">
            {stats.todayComparisons}
          </div>
          <div className="text-xs text-foreground-subtle">comparisons made</div>
        </div>
      </div>

      {stats.last7Days && stats.last7Days.length > 0 && (
        <>
          <div className="border-t border-border/50" />
          <ActivityBar days={stats.last7Days} />
        </>
      )}

      <div className="border-t border-border/50 pt-4 flex gap-6 text-xs text-foreground-subtle">
        <span>Avg {stats.averageComparisonsPerItem} comparisons/item</span>
        {stats.tieCount > 0 && <span>{stats.tieCount} ties recorded</span>}
      </div>
    </div>
  );
}

export function StatsPanel() {
  const stats = useQuery((api as any).stats?.getAggregatedStats);

  if (!stats) {
    return (
      <div className="bg-surface border border-border p-6">
        <div className="text-foreground-muted text-center">
          Loading stats...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border p-6">
      <StatsModalContent />
    </div>
  );
}

// Compact version for inline use
export function StatsCompact() {
  const stats = useQuery((api as any).stats?.getAggregatedStats);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm text-foreground-muted">
      <span className="flex items-center gap-1">
        <Target className="size-4" />
        {stats.totalComparisons} comparisons
      </span>
      {stats.streak > 0 && (
        <span className="flex items-center gap-1">
          <Flame className="size-4 text-orange-500" />
          {stats.streak} day streak
        </span>
      )}
    </div>
  );
}
