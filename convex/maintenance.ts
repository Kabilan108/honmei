import { internalMutation } from "./_generated/server";
import {
  COMPARISON_RETENTION_DAYS,
  DAYS_MS,
  GLICKO_DEFAULT_RD,
  RD_DECAY_PER_DAY,
} from "./lib/constants";

// 5.1 Archive old comparisons
export const archiveOldComparisons = internalMutation({
  handler: async (ctx) => {
    const cutoffTime = Date.now() - COMPARISON_RETENTION_DAYS * DAYS_MS;

    const oldComparisons = await ctx.db
      .query("comparisons")
      .withIndex("by_created_at")
      .filter((q) => q.lt(q.field("createdAt"), cutoffTime))
      .collect();

    for (const comparison of oldComparisons) {
      await ctx.db.delete(comparison._id);
    }

    console.log(
      `Archived ${oldComparisons.length} comparisons older than ${COMPARISON_RETENTION_DAYS} days`,
    );
  },
});

// 5.2 RD decay over time
export const decayRatings = internalMutation({
  handler: async (ctx) => {
    const oneDayAgo = Date.now() - DAYS_MS;

    const items = await ctx.db.query("userLibrary").collect();
    let decayedCount = 0;

    for (const item of items) {
      // Skip items compared within last 24 hours
      if (item.lastComparedAt && item.lastComparedAt > oneDayAgo) {
        continue;
      }

      // Calculate new RD: sqrt(rd^2 + rdDecayPerDay^2), capped at default
      const newRd = Math.min(
        GLICKO_DEFAULT_RD,
        Math.sqrt(item.rd ** 2 + RD_DECAY_PER_DAY ** 2),
      );

      // Only update if RD actually changed (avoid unnecessary writes)
      if (newRd > item.rd) {
        await ctx.db.patch(item._id, { rd: newRd });
        decayedCount++;
      }
    }

    console.log(`Decayed RD for ${decayedCount} items not compared recently`);
  },
});
