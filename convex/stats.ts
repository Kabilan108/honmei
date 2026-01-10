import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { DAYS_MS } from "./lib/constants";

// Helper to get midnight timestamp for a date
function getMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

// Get the aggregated stats (fast O(1) read)
export const getAggregatedStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("userStats").first();
    const libraryItems = await ctx.db.query("userLibrary").collect();

    // Count anime vs manga
    const animeCount = libraryItems.filter(
      (i) => i.mediaType === "ANIME",
    ).length;
    const mangaCount = libraryItems.filter(
      (i) => i.mediaType === "MANGA",
    ).length;

    // Get today's comparisons from last7Days
    const today = getMidnight(Date.now());
    const todayEntry = stats?.last7Days.find((d) => d.date === today);
    const todayComparisons = todayEntry?.count ?? 0;

    // Calculate average comparisons per item
    const averageComparisonsPerItem =
      libraryItems.length > 0
        ? Math.round(
            libraryItems.reduce((sum, item) => sum + item.comparisonCount, 0) /
              libraryItems.length,
          )
        : 0;

    // Format last7Days with day names for the activity chart
    const last7Days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today - i * DAYS_MS);
      const dayStart = getMidnight(date.getTime());
      const entry = stats?.last7Days.find((d) => d.date === dayStart);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      last7Days.push({ day: dayName, count: entry?.count ?? 0 });
    }

    return {
      totalComparisons: stats?.totalComparisons ?? 0,
      todayComparisons,
      streak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      streakDays: [],
      animeCount,
      mangaCount,
      totalItems: libraryItems.length,
      stability: 100,
      last7Days,
      tieCount: stats?.tieCount ?? 0,
      averageComparisonsPerItem,
    };
  },
});

// Initialize or get the singleton stats document
export const getOrInitializeStats = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("userStats").first();
    if (existing) {
      return existing;
    }

    // Initialize with empty stats
    const now = Date.now();
    const id = await ctx.db.insert("userStats", {
      totalComparisons: 0,
      tieCount: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastComparisonDate: undefined,
      last7Days: [],
      updatedAt: now,
    });

    return await ctx.db.get(id);
  },
});

// Internal helper to update stats after a comparison
export async function updateStatsAfterComparison(
  ctx: { db: any },
  isTie: boolean,
) {
  const now = Date.now();
  const today = getMidnight(now);

  const stats = await ctx.db.query("userStats").first();

  if (!stats) {
    // Initialize if doesn't exist
    await ctx.db.insert("userStats", {
      totalComparisons: 1,
      tieCount: isTie ? 1 : 0,
      currentStreak: 1,
      longestStreak: 1,
      lastComparisonDate: today,
      last7Days: [{ date: today, count: 1 }],
      updatedAt: now,
    });
    return;
  }

  // Calculate new streak
  let newStreak = stats.currentStreak;
  let newLongestStreak = stats.longestStreak;

  if (stats.lastComparisonDate === today) {
    // Same day, streak unchanged
  } else if (stats.lastComparisonDate === today - DAYS_MS) {
    // Yesterday, extend streak
    newStreak = stats.currentStreak + 1;
    newLongestStreak = Math.max(newLongestStreak, newStreak);
  } else if (stats.lastComparisonDate === undefined) {
    // First ever comparison
    newStreak = 1;
    newLongestStreak = Math.max(newLongestStreak, 1);
  } else if (stats.lastComparisonDate < today - DAYS_MS) {
    // Gap in activity, reset streak
    newStreak = 1;
  }

  // Update last7Days array
  let newLast7Days = [...stats.last7Days];
  const todayIndex = newLast7Days.findIndex((d) => d.date === today);

  if (todayIndex >= 0) {
    // Today already exists, increment count
    newLast7Days[todayIndex] = {
      ...newLast7Days[todayIndex],
      count: newLast7Days[todayIndex].count + 1,
    };
  } else {
    // Add today
    newLast7Days.push({ date: today, count: 1 });
  }

  // Keep only last 7 days
  const sevenDaysAgo = today - 7 * DAYS_MS;
  newLast7Days = newLast7Days.filter((d) => d.date >= sevenDaysAgo);

  // Sort by date ascending
  newLast7Days.sort((a, b) => a.date - b.date);

  await ctx.db.patch(stats._id, {
    totalComparisons: stats.totalComparisons + 1,
    tieCount: isTie ? stats.tieCount + 1 : stats.tieCount,
    currentStreak: newStreak,
    longestStreak: newLongestStreak,
    lastComparisonDate: today,
    last7Days: newLast7Days,
    updatedAt: now,
  });
}

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

    // Count anime vs manga using denormalized mediaType
    const animeCount = libraryItems.filter(
      (i) => i.mediaType === "ANIME",
    ).length;
    const mangaCount = libraryItems.filter(
      (i) => i.mediaType === "MANGA",
    ).length;

    // Calculate streak
    const streak = calculateStreak(comparisons);

    // Get today's comparisons
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayComparisons = comparisons.filter(
      (c) => c.createdAt >= todayStart,
    ).length;

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
              libraryItems.reduce(
                (sum, item) => sum + item.comparisonCount,
                0,
              ) / libraryItems.length,
            )
          : 0,
    };
  },
});

// Calculate current streak and longest streak
function calculateStreak(comparisons: { createdAt: number }[]): {
  current: number;
  longest: number;
  days: string[];
} {
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
  recentComparisons: { winnerId: string; loserId: string }[],
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
  comparisons: { createdAt: number }[],
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
      (c) => c.createdAt >= dayStart && c.createdAt < dayEnd,
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

    // Get items, optionally filtered by type
    let filtered: Doc<"userLibrary">[];
    if (args.mediaType) {
      const mediaType = args.mediaType;
      filtered = await ctx.db
        .query("userLibrary")
        .withIndex("by_media_type", (q) => q.eq("mediaType", mediaType))
        .collect();
      // Sort by Elo (can't use multiple indexes)
      filtered.sort((a, b) => b.eloRating - a.eloRating);
    } else {
      filtered = await ctx.db
        .query("userLibrary")
        .withIndex("by_elo_rating")
        .order("desc")
        .collect();
    }

    const total = filtered.length;

    return filtered.slice(0, limit).map((item, index) => {
      const rank = index + 1;
      const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
      const score = Math.round((percentile / 10) * 10) / 10;

      return {
        rank,
        title: item.mediaTitle,
        coverImage: item.mediaCoverImage,
        type: item.mediaType,
        eloRating: item.eloRating,
        percentileScore: score,
        comparisonCount: item.comparisonCount,
      };
    });
  },
});
