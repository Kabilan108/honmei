import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import { importLogger } from "./lib/logger";
import { malScoreToElo, malStatusToWatchStatus } from "./lib/malUtils";

export const startImport = mutation({
  args: {
    items: v.array(
      v.object({
        malId: v.number(),
        type: v.union(v.literal("ANIME"), v.literal("MANGA")),
        title: v.string(),
        score: v.number(),
        malStatus: v.string(),
        episodes: v.optional(v.number()),
        chapters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const BATCH_SIZE = 5;
    const totalBatches = Math.ceil(args.items.length / BATCH_SIZE);

    const jobId = await ctx.db.insert("importJobs", {
      status: "pending",
      items: args.items,
      totalItems: args.items.length,
      processedItems: 0,
      successCount: 0,
      failCount: 0,
      currentBatch: 0,
      totalBatches,
      startedAt: Date.now(),
    });

    importLogger.started(jobId, args.items.length);

    await ctx.scheduler.runAfter(0, internal.importJob.processBatch, {
      jobId,
      batchIndex: 0,
    });

    return jobId;
  },
});

export const getJob = internalQuery({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const updateJobStatus = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),
    currentBatch: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, status, currentBatch, error }) => {
    const updates: Record<string, unknown> = { status };
    if (currentBatch !== undefined) updates.currentBatch = currentBatch;
    if (error !== undefined) updates.error = error;
    await ctx.db.patch(jobId, updates);
  },
});

export const updateProgress = internalMutation({
  args: {
    jobId: v.id("importJobs"),
    processedItems: v.number(),
    successDelta: v.number(),
    failDelta: v.number(),
  },
  handler: async (ctx, { jobId, processedItems, successDelta, failDelta }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    await ctx.db.patch(jobId, {
      processedItems,
      successCount: job.successCount + successDelta,
      failCount: job.failCount + failDelta,
    });
  },
});

export const completeJob = internalMutation({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return;

    await ctx.db.patch(jobId, {
      status: "completed",
      completedAt: Date.now(),
    });

    importLogger.completed(jobId, job.successCount, job.failCount);
  },
});

export const importSingleItem = internalMutation({
  args: {
    item: v.object({
      malId: v.number(),
      type: v.union(v.literal("ANIME"), v.literal("MANGA")),
      title: v.string(),
      score: v.number(),
      malStatus: v.string(),
      episodes: v.optional(v.number()),
      chapters: v.optional(v.number()),
    }),
    anilistData: v.optional(
      v.object({
        anilistId: v.number(),
        title: v.string(),
        titleEnglish: v.optional(v.string()),
        coverImage: v.optional(v.string()),
        bannerImage: v.optional(v.string()),
        genres: v.array(v.string()),
        format: v.optional(v.string()),
        episodes: v.optional(v.number()),
        chapters: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, { item, anilistData }) => {
    try {
      const existingByMal = await ctx.db
        .query("mediaItems")
        .withIndex("by_mal_id", (q) => q.eq("malId", item.malId))
        .first();

      let mediaItemId: Id<"mediaItems">;

      if (existingByMal) {
        mediaItemId = existingByMal._id;
        if (
          anilistData?.coverImage &&
          !existingByMal.coverImage.startsWith("https://s4.anilist.co")
        ) {
          await ctx.db.patch(existingByMal._id, {
            anilistId: anilistData.anilistId,
            title: anilistData.title,
            titleEnglish: anilistData.titleEnglish,
            coverImage: anilistData.coverImage,
            bannerImage: anilistData.bannerImage,
            genres: anilistData.genres,
            format: anilistData.format,
          });
        }
      } else {
        const coverImage =
          anilistData?.coverImage ??
          `https://cdn.myanimelist.net/images/${item.type.toLowerCase()}/${item.malId}.jpg`;

        mediaItemId = await ctx.db.insert("mediaItems", {
          anilistId: anilistData?.anilistId ?? item.malId * -1,
          malId: item.malId,
          type: item.type,
          title: anilistData?.title ?? item.title,
          titleEnglish: anilistData?.titleEnglish,
          coverImage,
          bannerImage: anilistData?.bannerImage,
          genres: anilistData?.genres ?? [],
          tags: [],
          format: anilistData?.format,
          episodes: anilistData?.episodes ?? item.episodes,
          chapters: anilistData?.chapters ?? item.chapters,
        });
      }

      const existingInLibrary = await ctx.db
        .query("userLibrary")
        .withIndex("by_media_item", (q) => q.eq("mediaItemId", mediaItemId))
        .first();

      if (existingInLibrary) {
        return { success: true, skipped: true };
      }

      const now = Date.now();
      const eloRating = malScoreToElo(item.score);
      const watchStatus = malStatusToWatchStatus(item.malStatus);

      // Get cover image and title for denormalized fields
      const coverImage =
        anilistData?.coverImage ??
        `https://cdn.myanimelist.net/images/${item.type.toLowerCase()}/${item.malId}.jpg`;
      const title = anilistData?.title ?? item.title;
      const genres = anilistData?.genres ?? [];

      await ctx.db.insert("userLibrary", {
        mediaItemId,
        // Denormalized fields
        mediaTitle: title,
        mediaCoverImage: coverImage,
        mediaBannerImage: anilistData?.bannerImage,
        mediaType: item.type,
        mediaGenres: genres,
        // Elo fields
        eloRating,
        comparisonCount: 0,
        customTags: [],
        watchStatus,
        addedAt: now,
        updatedAt: now,
      });

      return { success: true, skipped: false };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Failed to import ${item.title}: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  },
});

export const getImportStatus = query({
  args: { jobId: v.id("importJobs") },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;

    return {
      status: job.status,
      totalItems: job.totalItems,
      processedItems: job.processedItems,
      successCount: job.successCount,
      failCount: job.failCount,
      currentBatch: job.currentBatch,
      totalBatches: job.totalBatches,
      progress:
        job.totalItems > 0 ? (job.processedItems / job.totalItems) * 100 : 0,
    };
  },
});

export const startRefetchFailedCovers = mutation({
  args: {},
  handler: async (ctx) => {
    const mediaItems = await ctx.db.query("mediaItems").collect();
    const failedItems = mediaItems.flatMap((item) => {
      if (item.anilistId < 0 && item.malId !== undefined) {
        return [
          {
            mediaItemId: item._id,
            malId: item.malId,
            type: item.type,
            title: item.title,
          },
        ];
      }
      return [];
    });

    if (failedItems.length === 0) {
      return { started: false, message: "No items with failed covers found" };
    }

    await ctx.scheduler.runAfter(0, internal.importJob.refetchFailedCovers, {
      items: failedItems,
      batchIndex: 0,
    });

    return {
      started: true,
      itemCount: failedItems.length,
      message: `Started refetching covers for ${failedItems.length} items`,
    };
  },
});

export const getItemsWithFailedCovers = query({
  args: {},
  handler: async (ctx) => {
    const mediaItems = await ctx.db.query("mediaItems").collect();
    return mediaItems
      .filter((item) => item.anilistId < 0)
      .map((item) => ({
        _id: item._id,
        malId: item.malId,
        type: item.type,
        title: item.title,
        coverImage: item.coverImage,
      }));
  },
});

export const updateMediaItemCover = internalMutation({
  args: {
    mediaItemId: v.id("mediaItems"),
    anilistId: v.number(),
    title: v.string(),
    titleEnglish: v.optional(v.string()),
    coverImage: v.string(),
    bannerImage: v.optional(v.string()),
    genres: v.array(v.string()),
    format: v.optional(v.string()),
    episodes: v.optional(v.number()),
    chapters: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { mediaItemId, ...updates } = args;
    await ctx.db.patch(mediaItemId, updates);
  },
});

export const getActiveImport = query({
  args: {},
  handler: async (ctx) => {
    const activeJob = await ctx.db
      .query("importJobs")
      .withIndex("by_status", (q) => q.eq("status", "processing"))
      .first();

    if (activeJob) {
      return {
        jobId: activeJob._id,
        status: activeJob.status,
        totalItems: activeJob.totalItems,
        processedItems: activeJob.processedItems,
        progress:
          activeJob.totalItems > 0
            ? (activeJob.processedItems / activeJob.totalItems) * 100
            : 0,
      };
    }

    const pendingJob = await ctx.db
      .query("importJobs")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .first();

    if (pendingJob) {
      return {
        jobId: pendingJob._id,
        status: pendingJob.status,
        totalItems: pendingJob.totalItems,
        processedItems: pendingJob.processedItems,
        progress: 0,
      };
    }

    return null;
  },
});
