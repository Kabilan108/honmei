import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
  COMPARISON_RESURFACE_DAYS_ESTABLISHED,
  COMPARISON_RESURFACE_DAYS_NEW,
  DAYS_MS,
  RD_CONFIDENCE_THRESHOLD,
} from "./lib/constants";
import { processComparison, processTie, type RatingData } from "./lib/glicko2";
import { updateRankedCount, updateStatsAfterComparison } from "./stats";

function getNextComparisonDue(rd: number): number {
  const now = Date.now();
  if (rd > RD_CONFIDENCE_THRESHOLD) {
    return now + DAYS_MS * COMPARISON_RESURFACE_DAYS_NEW;
  }
  return now + DAYS_MS * COMPARISON_RESURFACE_DAYS_ESTABLISHED;
}

function getOrderedPairIds(
  id1: Id<"userLibrary">,
  id2: Id<"userLibrary">,
): { itemA: Id<"userLibrary">; itemB: Id<"userLibrary"> } {
  return id1 < id2 ? { itemA: id1, itemB: id2 } : { itemA: id2, itemB: id1 };
}

async function upsertComparisonPair(
  ctx: MutationCtx,
  id1: Id<"userLibrary">,
  id2: Id<"userLibrary">,
) {
  const now = Date.now();
  const { itemA, itemB } = getOrderedPairIds(id1, id2);

  const existing = await ctx.db
    .query("comparisonPairs")
    .withIndex("by_items", (q) => q.eq("itemA", itemA).eq("itemB", itemB))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      comparisonCount: existing.comparisonCount + 1,
      lastComparedAt: now,
    });
  } else {
    await ctx.db.insert("comparisonPairs", {
      itemA,
      itemB,
      comparisonCount: 1,
      lastComparedAt: now,
    });
  }
}

export const getRandomPair = query({
  args: {},
  handler: async (ctx) => {
    const allItems = await ctx.db.query("userLibrary").collect();

    if (allItems.length < 2) {
      return null;
    }

    const shuffled = allItems.sort(() => Math.random() - 0.5);
    const item1 = shuffled[0];
    const item2 = shuffled[1];

    const media1 = await ctx.db.get(item1.mediaItemId);
    const media2 = await ctx.db.get(item2.mediaItemId);

    return {
      item1: { ...item1, media: media1 },
      item2: { ...item2, media: media2 },
    };
  },
});

export const recordComparison = mutation({
  args: {
    winnerId: v.id("userLibrary"),
    loserId: v.id("userLibrary"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const winner = await ctx.db.get(args.winnerId);
    const loser = await ctx.db.get(args.loserId);

    if (!winner || !loser) {
      throw new Error("One or both items not found");
    }

    const winnerRating: RatingData = {
      rating: winner.rating,
      rd: winner.rd,
      volatility: winner.volatility,
    };

    const loserRating: RatingData = {
      rating: loser.rating,
      rd: loser.rd,
      volatility: loser.volatility,
    };

    const result = processComparison(winnerRating, loserRating);

    await ctx.db.patch(args.winnerId, {
      rating: result.winner.rating,
      rd: result.winner.rd,
      volatility: result.winner.volatility,
      comparisonCount: winner.comparisonCount + 1,
      totalWins: winner.totalWins + 1,
      lastComparedAt: now,
      nextComparisonDue: getNextComparisonDue(result.winner.rd),
      needsReranking: false,
      updatedAt: now,
    });

    await ctx.db.patch(args.loserId, {
      rating: result.loser.rating,
      rd: result.loser.rd,
      volatility: result.loser.volatility,
      comparisonCount: loser.comparisonCount + 1,
      totalLosses: loser.totalLosses + 1,
      lastComparedAt: now,
      nextComparisonDue: getNextComparisonDue(result.loser.rd),
      needsReranking: false,
      updatedAt: now,
    });

    await updateRankedCount(
      ctx,
      winner.mediaType,
      winner.rd <= RD_CONFIDENCE_THRESHOLD,
      result.winner.rd <= RD_CONFIDENCE_THRESHOLD,
    );
    await updateRankedCount(
      ctx,
      loser.mediaType,
      loser.rd <= RD_CONFIDENCE_THRESHOLD,
      result.loser.rd <= RD_CONFIDENCE_THRESHOLD,
    );

    const comparisonId = await ctx.db.insert("comparisons", {
      winnerId: args.winnerId,
      loserId: args.loserId,
      isTie: false,
      createdAt: now,
    });

    await upsertComparisonPair(ctx, args.winnerId, args.loserId);

    await updateStatsAfterComparison(ctx, false);

    return {
      comparisonId,
      winnerNew: result.winner.rating,
      loserNew: result.loser.rating,
      winnerRd: result.winner.rd,
      loserRd: result.loser.rd,
      undoData: {
        winnerId: args.winnerId,
        loserId: args.loserId,
        isTie: false,
        winnerOld: winnerRating,
        loserOld: loserRating,
        winnerOldWins: winner.totalWins,
        loserOldLosses: loser.totalLosses,
        winnerOldCompCount: winner.comparisonCount,
        loserOldCompCount: loser.comparisonCount,
      },
    };
  },
});

export const recordTie = mutation({
  args: {
    item1Id: v.id("userLibrary"),
    item2Id: v.id("userLibrary"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const item1 = await ctx.db.get(args.item1Id);
    const item2 = await ctx.db.get(args.item2Id);

    if (!item1 || !item2) {
      throw new Error("One or both items not found");
    }

    const item1Rating: RatingData = {
      rating: item1.rating,
      rd: item1.rd,
      volatility: item1.volatility,
    };

    const item2Rating: RatingData = {
      rating: item2.rating,
      rd: item2.rd,
      volatility: item2.volatility,
    };

    const result = processTie(item1Rating, item2Rating);

    await ctx.db.patch(args.item1Id, {
      rating: result.item1.rating,
      rd: result.item1.rd,
      volatility: result.item1.volatility,
      comparisonCount: item1.comparisonCount + 1,
      totalTies: item1.totalTies + 1,
      lastComparedAt: now,
      nextComparisonDue: getNextComparisonDue(result.item1.rd),
      needsReranking: false,
      updatedAt: now,
    });

    await ctx.db.patch(args.item2Id, {
      rating: result.item2.rating,
      rd: result.item2.rd,
      volatility: result.item2.volatility,
      comparisonCount: item2.comparisonCount + 1,
      totalTies: item2.totalTies + 1,
      lastComparedAt: now,
      nextComparisonDue: getNextComparisonDue(result.item2.rd),
      needsReranking: false,
      updatedAt: now,
    });

    await updateRankedCount(
      ctx,
      item1.mediaType,
      item1.rd <= RD_CONFIDENCE_THRESHOLD,
      result.item1.rd <= RD_CONFIDENCE_THRESHOLD,
    );
    await updateRankedCount(
      ctx,
      item2.mediaType,
      item2.rd <= RD_CONFIDENCE_THRESHOLD,
      result.item2.rd <= RD_CONFIDENCE_THRESHOLD,
    );

    const comparisonId = await ctx.db.insert("comparisons", {
      winnerId: args.item1Id,
      loserId: args.item2Id,
      isTie: true,
      createdAt: now,
    });

    await upsertComparisonPair(ctx, args.item1Id, args.item2Id);

    await updateStatsAfterComparison(ctx, true);

    return {
      comparisonId,
      item1Rating: result.item1.rating,
      item2Rating: result.item2.rating,
      item1Rd: result.item1.rd,
      item2Rd: result.item2.rd,
      undoData: {
        item1Id: args.item1Id,
        item2Id: args.item2Id,
        isTie: true,
        item1Old: item1Rating,
        item2Old: item2Rating,
        item1OldTies: item1.totalTies,
        item2OldTies: item2.totalTies,
        item1OldCompCount: item1.comparisonCount,
        item2OldCompCount: item2.comparisonCount,
      },
    };
  },
});

async function decrementComparisonPair(
  ctx: MutationCtx,
  id1: Id<"userLibrary">,
  id2: Id<"userLibrary">,
) {
  const { itemA, itemB } = getOrderedPairIds(id1, id2);

  const existing = await ctx.db
    .query("comparisonPairs")
    .withIndex("by_items", (q) => q.eq("itemA", itemA).eq("itemB", itemB))
    .first();

  if (existing) {
    if (existing.comparisonCount <= 1) {
      await ctx.db.delete(existing._id);
    } else {
      await ctx.db.patch(existing._id, {
        comparisonCount: existing.comparisonCount - 1,
      });
    }
  }
}

export const undoComparison = mutation({
  args: {
    comparisonId: v.id("comparisons"),
    item1Id: v.id("userLibrary"),
    item2Id: v.id("userLibrary"),
    isTie: v.boolean(),
    item1Old: v.object({
      rating: v.number(),
      rd: v.number(),
      volatility: v.number(),
    }),
    item2Old: v.object({
      rating: v.number(),
      rd: v.number(),
      volatility: v.number(),
    }),
    item1OldCompCount: v.number(),
    item2OldCompCount: v.number(),
    item1OldWins: v.optional(v.number()),
    item1OldLosses: v.optional(v.number()),
    item1OldTies: v.optional(v.number()),
    item2OldWins: v.optional(v.number()),
    item2OldLosses: v.optional(v.number()),
    item2OldTies: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const comparison = await ctx.db.get(args.comparisonId);
    if (!comparison) {
      throw new Error("Comparison not found");
    }

    const item1 = await ctx.db.get(args.item1Id);
    const item2 = await ctx.db.get(args.item2Id);

    if (!item1 || !item2) {
      throw new Error("One or both items not found");
    }

    const now = Date.now();

    const item1WasRanked = item1.rd <= RD_CONFIDENCE_THRESHOLD;
    const item1WillBeRanked = args.item1Old.rd <= RD_CONFIDENCE_THRESHOLD;
    const item2WasRanked = item2.rd <= RD_CONFIDENCE_THRESHOLD;
    const item2WillBeRanked = args.item2Old.rd <= RD_CONFIDENCE_THRESHOLD;

    await ctx.db.patch(args.item1Id, {
      rating: args.item1Old.rating,
      rd: args.item1Old.rd,
      volatility: args.item1Old.volatility,
      comparisonCount: args.item1OldCompCount,
      totalWins: args.item1OldWins ?? item1.totalWins,
      totalLosses: args.item1OldLosses ?? item1.totalLosses,
      totalTies: args.item1OldTies ?? item1.totalTies,
      updatedAt: now,
    });

    await ctx.db.patch(args.item2Id, {
      rating: args.item2Old.rating,
      rd: args.item2Old.rd,
      volatility: args.item2Old.volatility,
      comparisonCount: args.item2OldCompCount,
      totalWins: args.item2OldWins ?? item2.totalWins,
      totalLosses: args.item2OldLosses ?? item2.totalLosses,
      totalTies: args.item2OldTies ?? item2.totalTies,
      updatedAt: now,
    });

    await updateRankedCount(
      ctx,
      item1.mediaType,
      item1WasRanked,
      item1WillBeRanked,
    );
    await updateRankedCount(
      ctx,
      item2.mediaType,
      item2WasRanked,
      item2WillBeRanked,
    );

    await ctx.db.delete(args.comparisonId);

    await decrementComparisonPair(ctx, args.item1Id, args.item2Id);

    const stats = await ctx.db.query("userStats").first();
    if (stats) {
      await ctx.db.patch(stats._id, {
        totalComparisons: Math.max(0, stats.totalComparisons - 1),
        tieCount: args.isTie ? Math.max(0, stats.tieCount - 1) : stats.tieCount,
        updatedAt: now,
      });
    }

    return { success: true };
  },
});

export const getHistory = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    const comparisons = await ctx.db
      .query("comparisons")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);

    const history = await Promise.all(
      comparisons.map(async (comp) => {
        const winner = await ctx.db.get(comp.winnerId);
        const loser = await ctx.db.get(comp.loserId);

        return {
          ...comp,
          winner,
          loser,
        };
      }),
    );

    return history;
  },
});
