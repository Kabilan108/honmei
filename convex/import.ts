import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { malScoreToElo, malStatusToWatchStatus } from "./lib/malUtils";

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

    // Add to library with mapped Elo
    const now = Date.now();
    const eloRating = malScoreToElo(args.malScore ?? null);
    const watchStatus = malStatusToWatchStatus(args.malStatus);

    await ctx.db.insert("userLibrary", {
      mediaItemId,
      // Denormalized fields (prefer English title)
      mediaTitle: args.titleEnglish ?? args.title,
      mediaCoverImage: args.coverImage,
      mediaBannerImage: undefined,
      mediaType: args.type,
      mediaGenres: args.genres,
      // Elo fields
      eloRating,
      comparisonCount: 0,
      customTags: [],
      watchStatus,
      addedAt: now,
      updatedAt: now,
    });

    return { skipped: false, mediaItemId, eloRating };
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

    return {
      deletedComparisons: comparisons.length,
      deletedLibraryItems: libraryItems.length,
      deletedMediaItems: mediaItems.length,
    };
  },
});

// Reset all rankings to default (1500) and clear comparison history
export const resetRankings = mutation({
  args: {},
  handler: async (ctx) => {
    // Delete all comparisons
    const comparisons = await ctx.db.query("comparisons").collect();
    for (const comparison of comparisons) {
      await ctx.db.delete(comparison._id);
    }

    // Reset all library items to default Elo
    const libraryItems = await ctx.db.query("userLibrary").collect();
    for (const item of libraryItems) {
      await ctx.db.patch(item._id, {
        eloRating: 1500,
        comparisonCount: 0,
        lastComparedAt: undefined,
        nextComparisonDue: undefined,
        needsReranking: undefined,
      });
    }

    console.log(
      `Reset rankings: cleared ${comparisons.length} comparisons, reset ${libraryItems.length} items`,
    );

    return {
      clearedComparisons: comparisons.length,
      resetItems: libraryItems.length,
    };
  },
});
