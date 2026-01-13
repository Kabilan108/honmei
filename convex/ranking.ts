import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import { CLOSE_RATING_RANGE, RD_CONFIDENCE_THRESHOLD } from "./lib/constants";

const RANKABLE_STATUSES = [
  "COMPLETED",
  "WATCHING",
  "ON_HOLD",
  "DROPPED",
] as const;

type SkippedPair = [Id<"userLibrary">, Id<"userLibrary">];

function isPairSkipped(
  item1Id: Id<"userLibrary">,
  item2Id: Id<"userLibrary">,
  skippedPairs: SkippedPair[],
): boolean {
  return skippedPairs.some(
    ([a, b]) =>
      (a === item1Id && b === item2Id) || (a === item2Id && b === item1Id),
  );
}

function findSmartPair(
  filteredItems: Doc<"userLibrary">[],
  skippedPairs: SkippedPair[] = [],
): { item1: Doc<"userLibrary">; item2: Doc<"userLibrary"> } | null {
  if (filteredItems.length < 2) {
    return null;
  }

  const sortedByRating = [...filteredItems].sort((a, b) => b.rating - a.rating);

  const needsReranking = filteredItems.filter((item) => item.needsReranking);
  for (const primaryItem of needsReranking) {
    const opponent = findOpponent(primaryItem, filteredItems, sortedByRating);
    if (
      opponent &&
      !isPairSkipped(primaryItem._id, opponent._id, skippedPairs)
    ) {
      return { item1: primaryItem, item2: opponent };
    }
  }

  const highRdItems = filteredItems
    .filter((item) => item.rd > RD_CONFIDENCE_THRESHOLD)
    .sort((a, b) => b.rd - a.rd);

  for (const primaryItem of highRdItems) {
    const opponent = findBinarySearchOpponent(primaryItem, sortedByRating);
    if (
      opponent &&
      !isPairSkipped(primaryItem._id, opponent._id, skippedPairs)
    ) {
      return { item1: primaryItem, item2: opponent };
    }
  }

  const established = filteredItems.filter(
    (item) => item.rd <= RD_CONFIDENCE_THRESHOLD,
  );

  if (established.length >= 2) {
    const byLastCompared = [...established].sort((a, b) => {
      const aTime = a.lastComparedAt ?? 0;
      const bTime = b.lastComparedAt ?? 0;
      return aTime - bTime;
    });

    for (const primaryItem of byLastCompared) {
      const opponent = findCloseRatingOpponent(primaryItem, established);
      if (
        opponent &&
        !isPairSkipped(primaryItem._id, opponent._id, skippedPairs)
      ) {
        return { item1: primaryItem, item2: opponent };
      }
    }
  }

  const shuffled = [...filteredItems].sort(() => Math.random() - 0.5);
  for (let i = 0; i < shuffled.length - 1; i++) {
    for (let j = i + 1; j < shuffled.length; j++) {
      if (!isPairSkipped(shuffled[i]._id, shuffled[j]._id, skippedPairs)) {
        return { item1: shuffled[i], item2: shuffled[j] };
      }
    }
  }

  return null;
}

export const getSmartPair = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
    skippedPairs: v.optional(v.array(v.array(v.id("userLibrary")))),
  },
  handler: async (ctx, args) => {
    const allItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_type", (q) => q.eq("mediaType", args.mediaType))
      .collect();

    const rankableItems = allItems.filter((item) =>
      RANKABLE_STATUSES.includes(
        item.watchStatus as (typeof RANKABLE_STATUSES)[number],
      ),
    );

    const skipped = (args.skippedPairs ?? []) as SkippedPair[];
    return findSmartPair(rankableItems, skipped);
  },
});

export const getSmartPairWithStats = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
    skippedPairs: v.optional(v.array(v.array(v.id("userLibrary")))),
  },
  handler: async (ctx, args) => {
    const allItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_type", (q) => q.eq("mediaType", args.mediaType))
      .collect();

    const rankableItems = allItems.filter((item) =>
      RANKABLE_STATUSES.includes(
        item.watchStatus as (typeof RANKABLE_STATUSES)[number],
      ),
    );

    const skipped = (args.skippedPairs ?? []) as SkippedPair[];
    const pair = findSmartPair(rankableItems, skipped);

    const highRdItems = rankableItems.filter(
      (item) => item.rd > RD_CONFIDENCE_THRESHOLD,
    );

    const stats = {
      totalItems: rankableItems.length,
      itemsNeedingReranking: rankableItems.filter((i) => i.needsReranking)
        .length,
      unrankedItems: highRdItems.length,
      averageComparisons:
        rankableItems.length > 0
          ? Math.round(
              rankableItems.reduce((sum, i) => sum + i.comparisonCount, 0) /
                rankableItems.length,
            )
          : 0,
    };

    if (!pair) {
      return { pair: null, stats };
    }

    const [media1, media2] = await Promise.all([
      ctx.db.get(pair.item1.mediaItemId),
      ctx.db.get(pair.item2.mediaItemId),
    ]);

    const enrichedPair = {
      item1: {
        ...pair.item1,
        startYear: media1?.startDate?.year ?? null,
        episodes: media1?.episodes ?? null,
        chapters: media1?.chapters ?? null,
        format: media1?.format ?? null,
      },
      item2: {
        ...pair.item2,
        startYear: media2?.startDate?.year ?? null,
        episodes: media2?.episodes ?? null,
        chapters: media2?.chapters ?? null,
        format: media2?.format ?? null,
      },
    };

    return { pair: enrichedPair, stats };
  },
});

function findBinarySearchOpponent(
  primaryItem: Doc<"userLibrary">,
  sortedByRating: Doc<"userLibrary">[],
): Doc<"userLibrary"> | null {
  const totalItems = sortedByRating.length;
  if (totalItems < 2) return null;

  let targetIndex: number;

  if (primaryItem.comparisonCount === 0) {
    targetIndex = Math.floor(totalItems / 2);
  } else if (primaryItem.comparisonCount === 1) {
    const currentRank = sortedByRating.findIndex(
      (item) => item._id === primaryItem._id,
    );
    if (currentRank < totalItems / 2) {
      targetIndex = Math.floor(totalItems * 0.25);
    } else {
      targetIndex = Math.floor(totalItems * 0.75);
    }
  } else {
    const currentRank = sortedByRating.findIndex(
      (item) => item._id === primaryItem._id,
    );
    if (primaryItem.comparisonCount % 2 === 0) {
      targetIndex = Math.max(0, currentRank - Math.floor(totalItems / 4));
    } else {
      targetIndex = Math.min(
        totalItems - 1,
        currentRank + Math.floor(totalItems / 4),
      );
    }
  }

  let opponent = sortedByRating[targetIndex];
  if (opponent._id === primaryItem._id) {
    opponent =
      sortedByRating[targetIndex + 1] ||
      sortedByRating[targetIndex - 1] ||
      null;
  }

  return opponent;
}

function findCloseRatingOpponent(
  primaryItem: Doc<"userLibrary">,
  allItems: Doc<"userLibrary">[],
): Doc<"userLibrary"> | null {
  const targetRating = primaryItem.rating;

  const closeRatingItems = allItems.filter(
    (item) =>
      item._id !== primaryItem._id &&
      Math.abs(item.rating - targetRating) <= CLOSE_RATING_RANGE,
  );

  if (closeRatingItems.length === 0) {
    const others = allItems.filter((item) => item._id !== primaryItem._id);
    if (others.length === 0) return null;

    return others.sort(
      (a, b) =>
        Math.abs(a.rating - targetRating) - Math.abs(b.rating - targetRating),
    )[0];
  }

  const sortedByRecency = [...closeRatingItems].sort((a, b) => {
    const aTime = a.lastComparedAt ?? 0;
    const bTime = b.lastComparedAt ?? 0;
    return aTime - bTime;
  });

  return sortedByRecency[0];
}

function findOpponent(
  primaryItem: Doc<"userLibrary">,
  allItems: Doc<"userLibrary">[],
  sortedByRating: Doc<"userLibrary">[],
): Doc<"userLibrary"> | null {
  if (primaryItem.rd > RD_CONFIDENCE_THRESHOLD) {
    return findBinarySearchOpponent(primaryItem, sortedByRating);
  }
  return findCloseRatingOpponent(primaryItem, allItems);
}

export const getRankingStats = query({
  args: {
    mediaType: v.optional(v.union(v.literal("ANIME"), v.literal("MANGA"))),
  },
  handler: async (ctx, args) => {
    let filteredItems: Doc<"userLibrary">[];
    if (args.mediaType) {
      const mediaType = args.mediaType;
      filteredItems = await ctx.db
        .query("userLibrary")
        .withIndex("by_media_type", (q) => q.eq("mediaType", mediaType))
        .collect();
    } else {
      filteredItems = await ctx.db.query("userLibrary").collect();
    }

    const comparisons = await ctx.db.query("comparisons").collect();

    const ties = comparisons.filter((c) => c.isTie).length;

    const needsReranking = filteredItems.filter((item) => item.needsReranking);

    const unrankedItems = filteredItems.filter(
      (item) => item.rd > RD_CONFIDENCE_THRESHOLD,
    );

    return {
      totalItems: filteredItems.length,
      totalComparisons: comparisons.length,
      totalTies: ties,
      itemsNeedingReranking: needsReranking.length,
      unrankedItems: unrankedItems.length,
      averageComparisons:
        filteredItems.length > 0
          ? Math.round(
              filteredItems.reduce(
                (sum, item) => sum + item.comparisonCount,
                0,
              ) / filteredItems.length,
            )
          : 0,
    };
  },
});

export const getItemsWithPercentile = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
  },
  handler: async (ctx, args) => {
    const filteredItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_type", (q) => q.eq("mediaType", args.mediaType))
      .collect();

    const sorted = filteredItems.sort((a, b) => b.rating - a.rating);
    const total = sorted.length;

    return sorted.map((item, index) => {
      const rank = index + 1;
      const itemsRankedBelow = total - rank;
      const percentile =
        total > 1 ? (itemsRankedBelow / (total - 1)) * 100 : 50;
      const score = percentile / 10;

      return {
        ...item,
        rank,
        percentileScore: Math.round(score * 10) / 10,
        totalInType: total,
      };
    });
  },
});

export const getDueComparisons = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allItems = await ctx.db.query("userLibrary").collect();

    const dueItems = allItems.filter((item) => {
      if (item.needsReranking) return true;
      if (item.nextComparisonDue && item.nextComparisonDue < now) return true;
      if (item.rd > RD_CONFIDENCE_THRESHOLD) return true;
      return false;
    });

    return {
      hasDueComparisons: dueItems.length > 0,
      dueCount: dueItems.length,
      needsReranking: dueItems.filter((i) => i.needsReranking).length,
      scheduled: dueItems.filter(
        (i) => i.nextComparisonDue && i.nextComparisonDue < now,
      ).length,
      unrankedItems: dueItems.filter((i) => i.rd > RD_CONFIDENCE_THRESHOLD)
        .length,
    };
  },
});

export const getRankedItems = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_type_and_rd", (q) =>
        q.eq("mediaType", args.mediaType).lte("rd", RD_CONFIDENCE_THRESHOLD),
      )
      .collect();

    return items.sort((a, b) => b.rating - a.rating);
  },
});

export const getUnrankedItems = query({
  args: {
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
  },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_type_and_rd", (q) =>
        q.eq("mediaType", args.mediaType).gt("rd", RD_CONFIDENCE_THRESHOLD),
      )
      .collect();

    return items.sort((a, b) => b.rd - a.rd);
  },
});

export const getUnrankedCount = query({
  args: {
    mediaType: v.optional(v.union(v.literal("ANIME"), v.literal("MANGA"))),
  },
  handler: async (ctx, args) => {
    const { mediaType } = args;
    if (mediaType) {
      const items = await ctx.db
        .query("userLibrary")
        .withIndex("by_media_type_and_rd", (q) =>
          q.eq("mediaType", mediaType).gt("rd", RD_CONFIDENCE_THRESHOLD),
        )
        .collect();
      return items.length;
    }

    const allItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_rd", (q) => q.gt("rd", RD_CONFIDENCE_THRESHOLD))
      .collect();
    return allItems.length;
  },
});
