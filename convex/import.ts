import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import {
  GLICKO_DEFAULT_RATING,
  GLICKO_DEFAULT_RD,
  GLICKO_DEFAULT_VOLATILITY,
} from "./lib/constants";
import { malScoreToRating, malStatusToWatchStatus } from "./lib/malUtils";
import { updateStatsOnLibraryChange } from "./stats";

// Import a single item from MAL data
export const importMalItem = mutation({
  args: {
    malId: v.number(),
    anilistId: v.optional(v.number()),
    type: v.union(v.literal("ANIME"), v.literal("MANGA")),
    title: v.string(),
    titleEnglish: v.optional(v.string()),
    coverImage: v.string(),
    genres: v.array(v.string()),
    malScore: v.optional(v.number()),
    malStatus: v.string(),
    episodes: v.optional(v.number()),
    chapters: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Check if we already have this item by MAL ID
    const existingByMal = await ctx.db
      .query("mediaItems")
      .withIndex("by_mal_id", (q) => q.eq("malId", args.malId))
      .first();

    let mediaItemId: Id<"mediaItems">;

    if (existingByMal) {
      mediaItemId = existingByMal._id;
    } else {
      // Create new media item
      mediaItemId = await ctx.db.insert("mediaItems", {
        anilistId: args.anilistId ?? args.malId * -1, // Use negative MAL ID as placeholder
        malId: args.malId,
        type: args.type,
        title: args.title,
        titleEnglish: args.titleEnglish,
        coverImage: args.coverImage,
        genres: args.genres,
        tags: [],
        episodes: args.episodes,
        chapters: args.chapters,
      });
    }

    // Check if already in library
    const existingInLibrary = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_item", (q) => q.eq("mediaItemId", mediaItemId))
      .first();

    if (existingInLibrary) {
      return { skipped: true, mediaItemId };
    }

    // Add to library with mapped rating
    const now = Date.now();
    const rating = malScoreToRating(args.malScore ?? null);
    const watchStatus = malStatusToWatchStatus(args.malStatus);

    await ctx.db.insert("userLibrary", {
      mediaItemId,
      // Denormalized fields (prefer English title)
      mediaTitle: args.titleEnglish ?? args.title,
      mediaCoverImage: args.coverImage,
      mediaBannerImage: undefined,
      mediaType: args.type,
      mediaGenres: args.genres,
      // Glicko-2 fields
      rating,
      rd: GLICKO_DEFAULT_RD,
      volatility: GLICKO_DEFAULT_VOLATILITY,
      comparisonCount: 0,
      totalWins: 0,
      totalLosses: 0,
      totalTies: 0,
      customTags: [],
      watchStatus,
      addedAt: now,
      updatedAt: now,
    });

    await updateStatsOnLibraryChange(ctx, args.type, GLICKO_DEFAULT_RD, "add");

    return { skipped: false, mediaItemId, rating };
  },
});

// Get import status for UI
export const getImportStats = mutation({
  args: {},
  handler: async (ctx) => {
    const libraryItems = await ctx.db.query("userLibrary").collect();
    const mediaItems = await ctx.db.query("mediaItems").collect();

    return {
      totalLibraryItems: libraryItems.length,
      totalMediaItems: mediaItems.length,
    };
  },
});

// Clear all library and media items (for re-importing)
export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all comparisons
    const comparisons = await ctx.db.query("comparisons").collect();
    for (const comparison of comparisons) {
      await ctx.db.delete(comparison._id);
    }

    // Delete all comparison pairs
    const comparisonPairs = await ctx.db.query("comparisonPairs").collect();
    for (const pair of comparisonPairs) {
      await ctx.db.delete(pair._id);
    }

    // Delete all library items
    const libraryItems = await ctx.db.query("userLibrary").collect();
    for (const item of libraryItems) {
      await ctx.db.delete(item._id);
    }

    // Delete all media items
    const mediaItems = await ctx.db.query("mediaItems").collect();
    for (const item of mediaItems) {
      await ctx.db.delete(item._id);
    }

    // Reset userStats
    const stats = await ctx.db.query("userStats").first();
    if (stats) {
      await ctx.db.patch(stats._id, {
        totalComparisons: 0,
        tieCount: 0,
        animeCount: 0,
        mangaCount: 0,
        rankedAnimeCount: 0,
        rankedMangaCount: 0,
        currentStreak: 0,
        last7Days: [],
        updatedAt: Date.now(),
      });
    }

    return {
      deletedComparisons: comparisons.length,
      deletedComparisonPairs: comparisonPairs.length,
      deletedLibraryItems: libraryItems.length,
      deletedMediaItems: mediaItems.length,
    };
  },
});

// Reset all rankings to default and clear comparison history
export const resetRankings = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all comparisons
    const comparisons = await ctx.db.query("comparisons").collect();
    for (const comparison of comparisons) {
      await ctx.db.delete(comparison._id);
    }

    // Delete all comparison pairs
    const comparisonPairs = await ctx.db.query("comparisonPairs").collect();
    for (const pair of comparisonPairs) {
      await ctx.db.delete(pair._id);
    }

    // Reset all library items to default Glicko-2 values
    const libraryItems = await ctx.db.query("userLibrary").collect();
    for (const item of libraryItems) {
      await ctx.db.patch(item._id, {
        rating: GLICKO_DEFAULT_RATING,
        rd: GLICKO_DEFAULT_RD,
        volatility: GLICKO_DEFAULT_VOLATILITY,
        comparisonCount: 0,
        totalWins: 0,
        totalLosses: 0,
        totalTies: 0,
        lastComparedAt: undefined,
        nextComparisonDue: undefined,
        needsReranking: undefined,
      });
    }

    console.log(
      `Reset rankings: cleared ${comparisons.length} comparisons, ${comparisonPairs.length} pairs, reset ${libraryItems.length} items`,
    );

    return {
      clearedComparisons: comparisons.length,
      clearedPairs: comparisonPairs.length,
      resetItems: libraryItems.length,
    };
  },
});
