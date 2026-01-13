import { v } from "convex/values";
import { query } from "./_generated/server";

// Get all library data for JSON export
export const getFullExport = query({
  args: {},
  handler: async (ctx) => {
    const libraryItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_rating")
      .order("desc")
      .collect();

    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item, index) => {
        const media = await ctx.db.get(item.mediaItemId);
        return {
          rank: index + 1,
          rating: item.rating,
          rd: item.rd,
          volatility: item.volatility,
          comparisonCount: item.comparisonCount,
          totalWins: item.totalWins,
          totalLosses: item.totalLosses,
          totalTies: item.totalTies,
          watchStatus: item.watchStatus,
          customTags: item.customTags,
          userNotes: item.userNotes,
          addedAt: item.addedAt,
          updatedAt: item.updatedAt,
          media: media
            ? {
                anilistId: media.anilistId,
                malId: media.malId,
                type: media.type,
                title: media.title,
                titleEnglish: media.titleEnglish,
                titleJapanese: media.titleJapanese,
                genres: media.genres,
                tags: media.tags,
                format: media.format,
                status: media.status,
                episodes: media.episodes,
                chapters: media.chapters,
                coverImage: media.coverImage,
              }
            : null,
        };
      }),
    );

    // Get comparison history
    const comparisons = await ctx.db
      .query("comparisons")
      .withIndex("by_created_at")
      .order("desc")
      .collect();

    return {
      exportedAt: new Date().toISOString(),
      version: "1.0",
      library: itemsWithMedia,
      comparisons: comparisons.map((c) => ({
        winnerId: c.winnerId,
        loserId: c.loserId,
        isTie: c.isTie,
        createdAt: c.createdAt,
      })),
      stats: {
        totalItems: libraryItems.length,
        totalComparisons: comparisons.length,
        animeCount: itemsWithMedia.filter((i) => i.media?.type === "ANIME")
          .length,
        mangaCount: itemsWithMedia.filter((i) => i.media?.type === "MANGA")
          .length,
      },
    };
  },
});

// Get CSV-friendly export data
export const getCsvExport = query({
  args: {
    mediaType: v.optional(v.union(v.literal("ANIME"), v.literal("MANGA"))),
  },
  handler: async (ctx, args) => {
    const libraryItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_rating")
      .order("desc")
      .collect();

    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      }),
    );

    // Filter by type if specified
    const filtered = args.mediaType
      ? itemsWithMedia.filter((i) => i.media?.type === args.mediaType)
      : itemsWithMedia;

    // Calculate percentile scores
    const total = filtered.length;

    return filtered.map((item, index) => {
      const rank = index + 1;
      const percentile = total > 1 ? ((total - rank) / (total - 1)) * 100 : 50;
      const score = Math.round((percentile / 10) * 10) / 10;

      return {
        rank,
        title: item.media?.title ?? "Unknown",
        titleEnglish: item.media?.titleEnglish ?? "",
        type: item.media?.type ?? "UNKNOWN",
        rating: item.rating,
        rd: item.rd,
        percentileScore: score,
        comparisonCount: item.comparisonCount,
        watchStatus: item.watchStatus,
        genres: item.media?.genres?.join(", ") ?? "",
        anilistId: item.media?.anilistId ?? "",
        malId: item.media?.malId ?? "",
      };
    });
  },
});
