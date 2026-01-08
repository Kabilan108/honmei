import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

// Constants for the pairing algorithm
const NEW_ITEM_THRESHOLD = 5; // Items with fewer comparisons are "new"
const CLOSE_RATING_RANGE = 100; // Match established items within ±100 Elo
const DAYS_MS = 24 * 60 * 60 * 1000;

// Get a smart pair for comparison, filtered by media type
export const getSmartPair = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
  },
  handler: async (ctx, args) => {
    // Get all library items with their media
    const allItems = await ctx.db.query("userLibrary").collect();

    // Filter to only items of the requested type
    const itemsWithMedia = await Promise.all(
      allItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      })
    );

    const filteredItems = itemsWithMedia.filter(
      (item) => item.media?.type === args.mediaType
    );

    if (filteredItems.length < 2) {
      return null; // Not enough items of this type
    }

    // Sort by Elo for percentile-based pairing
    const sortedByElo = [...filteredItems].sort(
      (a, b) => b.eloRating - a.eloRating
    );

    // Find items that need re-ranking first (triggered by status change to COMPLETED)
    const needsReranking = filteredItems.filter((item) => item.needsReranking);
    if (needsReranking.length > 0) {
      const primaryItem = needsReranking[0];
      const opponent = findOpponent(primaryItem, filteredItems, sortedByElo);
      if (opponent) {
        return { item1: primaryItem, item2: opponent };
      }
    }

    // Find new items that need binary-search placement
    const newItems = filteredItems.filter(
      (item) => item.comparisonCount < NEW_ITEM_THRESHOLD
    );

    if (newItems.length > 0) {
      // Pick the newest item with fewest comparisons
      const primaryItem = newItems.sort(
        (a, b) => a.comparisonCount - b.comparisonCount
      )[0];

      // Binary search: compare against items at strategic percentiles
      const opponent = findBinarySearchOpponent(
        primaryItem,
        filteredItems,
        sortedByElo
      );
      if (opponent) {
        return { item1: primaryItem, item2: opponent };
      }
    }

    // For established items: pair within close rating range
    // Prioritize items not compared recently
    const established = filteredItems.filter(
      (item) => item.comparisonCount >= NEW_ITEM_THRESHOLD
    );

    if (established.length >= 2) {
      // Sort by last compared time (oldest first), with null/undefined last
      const byLastCompared = [...established].sort((a, b) => {
        const aTime = a.lastComparedAt ?? 0;
        const bTime = b.lastComparedAt ?? 0;
        return aTime - bTime;
      });

      const primaryItem = byLastCompared[0];
      const opponent = findCloseRatingOpponent(
        primaryItem,
        established,
        sortedByElo
      );
      if (opponent) {
        return { item1: primaryItem, item2: opponent };
      }
    }

    // Fallback: random pairing from filtered items
    const shuffled = filteredItems.sort(() => Math.random() - 0.5);
    return { item1: shuffled[0], item2: shuffled[1] };
  },
});

// Find opponent for binary search placement of new items
function findBinarySearchOpponent<
  T extends { _id: Id<"userLibrary">; comparisonCount: number; eloRating: number }
>(primaryItem: T, allItems: T[], sortedByElo: T[]): T | null {
  const totalItems = sortedByElo.length;
  if (totalItems < 2) return null;

  // Based on comparison count, pick strategic percentile
  // 0 comparisons: 50th percentile (middle)
  // 1 comparison: 75th or 25th (based on current rating)
  // 2+ comparisons: refine further
  let targetIndex: number;

  if (primaryItem.comparisonCount === 0) {
    // Start at middle
    targetIndex = Math.floor(totalItems / 2);
  } else if (primaryItem.comparisonCount === 1) {
    // Based on current position, go to 25th or 75th
    const currentRank = sortedByElo.findIndex(
      (item) => item._id === primaryItem._id
    );
    if (currentRank < totalItems / 2) {
      // Currently in top half, compare against 75th percentile
      targetIndex = Math.floor(totalItems * 0.25);
    } else {
      // Currently in bottom half, compare against 25th percentile
      targetIndex = Math.floor(totalItems * 0.75);
    }
  } else {
    // Further refinement: find nearest uncompared item
    const currentRank = sortedByElo.findIndex(
      (item) => item._id === primaryItem._id
    );
    // Go to 1/4 or 3/4 of the remaining range
    if (primaryItem.comparisonCount % 2 === 0) {
      targetIndex = Math.max(0, currentRank - Math.floor(totalItems / 4));
    } else {
      targetIndex = Math.min(
        totalItems - 1,
        currentRank + Math.floor(totalItems / 4)
      );
    }
  }

  // Ensure we don't pick the primary item itself
  let opponent = sortedByElo[targetIndex];
  if (opponent._id === primaryItem._id) {
    // Try adjacent items
    opponent =
      sortedByElo[targetIndex + 1] || sortedByElo[targetIndex - 1] || null;
  }

  return opponent;
}

// Find opponent within close rating range for established items
function findCloseRatingOpponent<
  T extends { _id: Id<"userLibrary">; eloRating: number; lastComparedAt?: number }
>(primaryItem: T, allItems: T[], sortedByElo: T[]): T | null {
  const targetRating = primaryItem.eloRating;

  // Find items within the close rating range
  const closeRatingItems = allItems.filter(
    (item) =>
      item._id !== primaryItem._id &&
      Math.abs(item.eloRating - targetRating) <= CLOSE_RATING_RANGE
  );

  if (closeRatingItems.length === 0) {
    // No items in range, find the closest one
    const others = allItems.filter((item) => item._id !== primaryItem._id);
    if (others.length === 0) return null;

    return others.sort(
      (a, b) =>
        Math.abs(a.eloRating - targetRating) -
        Math.abs(b.eloRating - targetRating)
    )[0];
  }

  // Among close-rating items, prefer those not recently compared
  const sortedByRecency = [...closeRatingItems].sort((a, b) => {
    const aTime = a.lastComparedAt ?? 0;
    const bTime = b.lastComparedAt ?? 0;
    return aTime - bTime;
  });

  return sortedByRecency[0];
}

// Generic opponent finder
function findOpponent<
  T extends { _id: Id<"userLibrary">; comparisonCount: number; eloRating: number }
>(primaryItem: T, allItems: T[], sortedByElo: T[]): T | null {
  if (primaryItem.comparisonCount < NEW_ITEM_THRESHOLD) {
    return findBinarySearchOpponent(primaryItem, allItems, sortedByElo);
  }
  return findCloseRatingOpponent(primaryItem, allItems, sortedByElo);
}

// Get stats about the ranking
export const getRankingStats = query({
  args: {
    mediaType: v.optional(v.union(v.literal("ANIME"), v.literal("MANGA"))),
  },
  handler: async (ctx, args) => {
    const allItems = await ctx.db.query("userLibrary").collect();

    // Get media types for filtering
    const itemsWithMedia = await Promise.all(
      allItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      })
    );

    const filteredItems = args.mediaType
      ? itemsWithMedia.filter((item) => item.media?.type === args.mediaType)
      : itemsWithMedia;

    const comparisons = await ctx.db.query("comparisons").collect();

    // Count ties
    const ties = comparisons.filter((c) => c.isTie).length;

    // Get items needing re-ranking
    const needsReranking = filteredItems.filter((item) => item.needsReranking);

    // Get new items needing placement
    const newItems = filteredItems.filter(
      (item) => item.comparisonCount < NEW_ITEM_THRESHOLD
    );

    return {
      totalItems: filteredItems.length,
      totalComparisons: comparisons.length,
      totalTies: ties,
      itemsNeedingReranking: needsReranking.length,
      newItemsNeedingPlacement: newItems.length,
      averageComparisons:
        filteredItems.length > 0
          ? Math.round(
              filteredItems.reduce((sum, item) => sum + item.comparisonCount, 0) /
                filteredItems.length
            )
          : 0,
    };
  },
});

// Get items sorted by Elo with percentile scores
export const getItemsWithPercentile = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
  },
  handler: async (ctx, args) => {
    const allItems = await ctx.db.query("userLibrary").collect();

    const itemsWithMedia = await Promise.all(
      allItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return { ...item, media };
      })
    );

    const filteredItems = itemsWithMedia.filter(
      (item) => item.media?.type === args.mediaType
    );

    // Sort by Elo descending
    const sorted = filteredItems.sort((a, b) => b.eloRating - a.eloRating);
    const total = sorted.length;

    // Add rank and percentile score
    return sorted.map((item, index) => {
      const rank = index + 1;
      // Percentile: (items ranked below / total) * 100
      // Then convert to 0-10 scale
      const itemsRankedBelow = total - rank;
      const percentile = total > 1 ? (itemsRankedBelow / (total - 1)) * 100 : 50;
      const score = percentile / 10; // 0-10 scale

      return {
        ...item,
        rank,
        percentileScore: Math.round(score * 10) / 10, // Round to 1 decimal
        totalInType: total,
      };
    });
  },
});

// Check if there are due comparisons
export const getDueComparisons = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allItems = await ctx.db.query("userLibrary").collect();

    // Count items needing comparison
    const dueItems = allItems.filter((item) => {
      // Needs re-ranking (status changed to COMPLETED)
      if (item.needsReranking) return true;
      // Scheduled comparison is due
      if (item.nextComparisonDue && item.nextComparisonDue < now) return true;
      // New item with few comparisons
      if (item.comparisonCount < NEW_ITEM_THRESHOLD) return true;
      return false;
    });

    return {
      hasDueComparisons: dueItems.length > 0,
      dueCount: dueItems.length,
      needsReranking: dueItems.filter((i) => i.needsReranking).length,
      scheduled: dueItems.filter(
        (i) => i.nextComparisonDue && i.nextComparisonDue < now
      ).length,
      newItems: dueItems.filter((i) => i.comparisonCount < NEW_ITEM_THRESHOLD)
        .length,
    };
  },
});
