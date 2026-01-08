import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Flame, Target, BarChart3, Trophy, Calendar } from "lucide-react";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
}

function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="bg-neutral-800/50 p-4 space-y-1">
      <div className="flex items-center gap-2 text-neutral-400 text-sm">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {subtext && <div className="text-xs text-neutral-500">{subtext}</div>}
    </div>
  );
}

interface ActivityBarProps {
  days: { day: string; count: number }[];
}

function ActivityBar({ days }: ActivityBarProps) {
  const maxCount = Math.max(...days.map((d) => d.count), 1);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-neutral-400 text-sm">
        <Calendar className="size-4" />
        Last 7 Days
      </div>
      <div className="flex gap-1 items-end h-16">
        {days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-primary/60 transition-all"
              style={{
                height: `${(day.count / maxCount) * 100}%`,
                minHeight: day.count > 0 ? "4px" : "2px",
              }}
            />
            <span className="text-[10px] text-neutral-500">{day.day}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsPanel() {
  const stats = useQuery((api as any).stats?.getUserStats);

  if (!stats) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 p-6">
        <div className="text-neutral-400 text-center">Loading stats...</div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 p-6 space-y-6">
      <h3 className="font-semibold flex items-center gap-2">
        <BarChart3 className="size-5" />
        Your Stats
      </h3>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<Target className="size-4" />}
          label="Total Comparisons"
          value={stats.totalComparisons}
        />
        <StatCard
          icon={<Flame className="size-4" />}
          label="Current Streak"
          value={`${stats.streak} day${stats.streak !== 1 ? "s" : ""}`}
          subtext={`Best: ${stats.longestStreak} days`}
        />
        <StatCard
          icon={<Trophy className="size-4" />}
          label="Library Size"
          value={stats.totalItems}
          subtext={`${stats.animeCount} anime, ${stats.mangaCount} manga`}
        />
        <StatCard
          icon={<BarChart3 className="size-4" />}
          label="Today"
          value={stats.todayComparisons}
          subtext="comparisons"
        />
      </div>

      {/* Activity Chart */}
      {stats.last7Days && stats.last7Days.length > 0 && (
        <ActivityBar days={stats.last7Days} />
      )}

      {/* Additional Info */}
      <div className="flex gap-4 text-xs text-neutral-500">
        <span>Avg {stats.averageComparisonsPerItem} comparisons/item</span>
        {stats.tieCount > 0 && <span>{stats.tieCount} ties</span>}
      </div>
    </div>
  );
}

// Compact version for inline use
export function StatsCompact() {
  const stats = useQuery((api as any).stats?.getUserStats);

  if (!stats) return null;

  return (
    <div className="flex items-center gap-4 text-sm text-neutral-400">
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
