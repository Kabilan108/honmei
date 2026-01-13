import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { DAYS_MS, RD_CONFIDENCE_THRESHOLD } from "./lib/constants";

function getMidnight(timestamp: number): number {
  const date = new Date(timestamp);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export const getAggregatedStats = query({
  args: {},
  handler: async (ctx) => {
    const stats = await ctx.db.query("userStats").first();

    const today = getMidnight(Date.now());
    const todayEntry = stats?.last7Days.find((d) => d.date === today);
    const todayComparisons = todayEntry?.count ?? 0;

    const last7Days: { day: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today - i * DAYS_MS);
      const dayStart = getMidnight(date.getTime());
      const entry = stats?.last7Days.find((d) => d.date === dayStart);
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      last7Days.push({ day: dayName, count: entry?.count ?? 0 });
    }

    const animeCount = stats?.animeCount ?? 0;
    const mangaCount = stats?.mangaCount ?? 0;

    return {
      totalComparisons: stats?.totalComparisons ?? 0,
      todayComparisons,
      streak: stats?.currentStreak ?? 0,
      longestStreak: stats?.longestStreak ?? 0,
      streakDays: [],
      animeCount,
      mangaCount,
      totalItems: animeCount + mangaCount,
      last7Days,
      tieCount: stats?.tieCount ?? 0,
      rankedAnimeCount: stats?.rankedAnimeCount ?? 0,
      rankedMangaCount: stats?.rankedMangaCount ?? 0,
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
      animeCount: 0,
      mangaCount: 0,
      rankedAnimeCount: 0,
      rankedMangaCount: 0,
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
      animeCount: 0,
      mangaCount: 0,
      rankedAnimeCount: 0,
      rankedMangaCount: 0,
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

export async function updateStatsOnLibraryChange(
  ctx: MutationCtx,
  mediaType: "ANIME" | "MANGA",
  rd: number,
  action: "add" | "remove",
): Promise<void> {
  const stats = await ctx.db.query("userStats").first();
  const now = Date.now();
  const isRanked = rd <= RD_CONFIDENCE_THRESHOLD;
  const delta = action === "add" ? 1 : -1;

  if (!stats) {
    if (action === "remove") return;

    await ctx.db.insert("userStats", {
      totalComparisons: 0,
      tieCount: 0,
      animeCount: mediaType === "ANIME" ? 1 : 0,
      mangaCount: mediaType === "MANGA" ? 1 : 0,
      rankedAnimeCount: mediaType === "ANIME" && isRanked ? 1 : 0,
      rankedMangaCount: mediaType === "MANGA" && isRanked ? 1 : 0,
      currentStreak: 0,
      longestStreak: 0,
      lastComparisonDate: undefined,
      last7Days: [],
      updatedAt: now,
    });
    return;
  }

  const updates: Record<string, number> = { updatedAt: now };

  if (mediaType === "ANIME") {
    updates.animeCount = Math.max(0, (stats.animeCount ?? 0) + delta);
    if (isRanked) {
      updates.rankedAnimeCount = Math.max(
        0,
        (stats.rankedAnimeCount ?? 0) + delta,
      );
    }
  } else {
    updates.mangaCount = Math.max(0, (stats.mangaCount ?? 0) + delta);
    if (isRanked) {
      updates.rankedMangaCount = Math.max(
        0,
        (stats.rankedMangaCount ?? 0) + delta,
      );
    }
  }

  await ctx.db.patch(stats._id, updates);
}

export async function updateRankedCount(
  ctx: MutationCtx,
  mediaType: "ANIME" | "MANGA",
  wasRanked: boolean,
  isNowRanked: boolean,
): Promise<void> {
  if (wasRanked === isNowRanked) return;

  const stats = await ctx.db.query("userStats").first();
  if (!stats) return;

  const delta = isNowRanked ? 1 : -1;
  const field = mediaType === "ANIME" ? "rankedAnimeCount" : "rankedMangaCount";
  const currentValue =
    mediaType === "ANIME"
      ? (stats.rankedAnimeCount ?? 0)
      : (stats.rankedMangaCount ?? 0);

  await ctx.db.patch(stats._id, {
    [field]: Math.max(0, currentValue + delta),
    updatedAt: Date.now(),
  });
}

// Get leaderboard of top items by rating
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
      filtered.sort((a, b) => b.rating - a.rating);
    } else {
      filtered = await ctx.db
        .query("userLibrary")
        .withIndex("by_rating")
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
        rating: item.rating,
        rd: item.rd,
        percentileScore: score,
        comparisonCount: item.comparisonCount,
      };
    });
  },
});
