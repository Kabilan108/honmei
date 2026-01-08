import { v } from "convex/values";
import { query } from "./_generated/server";

const DAYS_MS = 24 * 60 * 60 * 1000;

// Get comprehensive user stats
export const getUserStats = query({
  args: {},
  handler: async (ctx) => {
    const comparisons = await ctx.db
      .query("comparisons")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    const libraryItems = await ctx.db.query("userLibrary").collect();

    // Count anime vs manga
    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      })
    );

    const animeCount = itemsWithMedia.filter((i) => i.media?.type === "ANIME").length;
    const mangaCount = itemsWithMedia.filter((i) => i.media?.type === "MANGA").length;

    // Calculate streak
    const streak = calculateStreak(comparisons);

    // Get today's comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayComparisons = comparisons.filter((c) => c.createdAt >= todayStart).length;

    // Calculate ranking stability (how much ratings are changing)
    const recentComparisons = comparisons.slice(0, 20);
    const stability = calculateStability(recentComparisons);

    // Get comparison history for last 7 days
    const last7Days = getLast7DaysActivity(comparisons);

    // Count ties
    const tieCount = comparisons.filter((c) => c.isTie).length;

    return {
      totalComparisons: comparisons.length,
      todayComparisons,
      streak: streak.current,
      longestStreak: streak.longest,
      streakDays: streak.days,
      animeCount,
      mangaCount,
      totalItems: libraryItems.length,
      stability,
      last7Days,
      tieCount,
      averageComparisonsPerItem:
        libraryItems.length > 0
          ? Math.round(
              libraryItems.reduce((sum, item) => sum + item.comparisonCount, 0) /
                libraryItems.length
            )
          : 0,
    };
  },
});

// Calculate current streak and longest streak
function calculateStreak(
  comparisons: { createdAt: number }[]
): { current: number; longest: number; days: string[] } {
  if (comparisons.length === 0) {
    return { current: 0, longest: 0, days: [] };
  }

  // Get unique days with comparisons
  const daysWithComparisons = new Set<string>();
  comparisons.forEach((c) => {
    const date = new Date(c.createdAt);
    const dayKey = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    daysWithComparisons.add(dayKey);
  });

  // Sort days
  const sortedDays = Array.from(daysWithComparisons).sort().reverse();

  // Calculate current streak
  let currentStreak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  // Check if streak includes today or yesterday
  let checkDate = new Date(today);
  if (!daysWithComparisons.has(todayKey)) {
    if (!daysWithComparisons.has(yesterdayKey)) {
      currentStreak = 0;
    } else {
      checkDate = yesterday;
    }
  }

  if (currentStreak !== 0 || daysWithComparisons.has(todayKey)) {
    while (true) {
      const key = `${checkDate.getFullYear()}-${checkDate.getMonth()}-${checkDate.getDate()}`;
      if (daysWithComparisons.has(key)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
  }

  // Calculate longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  let prevDate: Date | null = null;

  for (const dayStr of sortedDays) {
    const parts = dayStr.split("-").map(Number);
    const date = new Date(parts[0], parts[1], parts[2]);

    if (prevDate === null) {
      tempStreak = 1;
    } else {
      const diff = (prevDate.getTime() - date.getTime()) / DAYS_MS;
      if (diff === 1) {
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }
    prevDate = date;
  }
  longestStreak = Math.max(longestStreak, tempStreak);

  return {
    current: currentStreak,
    longest: longestStreak,
    days: sortedDays.slice(0, 7),
  };
}

// Calculate ranking stability (0-100, higher = more stable)
function calculateStability(
  recentComparisons: { winnerId: string; loserId: string }[]
): number {
  if (recentComparisons.length < 5) {
    return 100; // Not enough data, assume stable
  }

  // In a stable ranking, winners and losers should be predictable
  // We can't easily measure this without more data, so use a simplified heuristic
  // More comparisons = more refined = more stable
  const comparisonDensity = Math.min(100, recentComparisons.length * 5);
  return comparisonDensity;
}

// Get activity for last 7 days
function getLast7DaysActivity(
  comparisons: { createdAt: number }[]
): { day: string; count: number }[] {
  const days: { day: string; count: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dayStart = date.getTime();
    const dayEnd = dayStart + DAYS_MS;

    const count = comparisons.filter(
      (c) => c.createdAt >= dayStart && c.createdAt < dayEnd
    ).length;

    const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
    days.push({ day: dayName, count });
  }

  return days;
}

// Get leaderboard of top items by Elo
export const getTopItems = query({
  args: {
    mediaType: v.optional(v.union(v.literal("ANIME"), v.literal("MANGA"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const libraryItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_elo_rating")
      .order("desc")
      .collect();

    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      })
    );

    let filtered = itemsWithMedia;
    if (args.mediaType) {
      filtered = itemsWithMedia.filter((i) => i.media?.type === args.mediaType);
    }

    const total = filtered.length;

    return filtered.slice(0, limit).map((item, index) => {
      const rank = index + 1;
      const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
      const score = Math.round((percentile / 10) * 10) / 10;

      return {
        rank,
        title: item.media?.title ?? "Unknown",
        coverImage: item.media?.coverImage,
        type: item.media?.type,
        eloRating: item.eloRating,
        percentileScore: score,
        comparisonCount: item.comparisonCount,
      };
    });
  },
});
