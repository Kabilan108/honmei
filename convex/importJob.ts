"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction } from "./_generated/server";
import { anilistLogger, importLogger } from "./lib/logger";

const ANILIST_API_URL = "https://graphql.anilist.co";
const ITEM_DELAY_MS = 4000;
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 1000;
const MAX_RETRIES = 2;

const MEDIA_BY_MAL_QUERY = `
  query ($idMal: Int, $type: MediaType) {
    Media(idMal: $idMal, type: $type) {
      id
      idMal
      type
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      format
      status
      episodes
      chapters
    }
  }
`;

const SEARCH_BY_TITLE_QUERY = `
  query ($search: String, $type: MediaType) {
    Media(search: $search, type: $type) {
      id
      idMal
      type
      title {
        romaji
        english
        native
      }
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      format
      status
      episodes
      chapters
    }
  }
`;

interface AniListMedia {
  id: number;
  idMal: number | null;
  type: "ANIME" | "MANGA";
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  coverImage: {
    large: string;
    extraLarge: string;
  } | null;
  bannerImage: string | null;
  genres: string[];
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
}

async function fetchAniListMedia(
  malId: number,
  type: "ANIME" | "MANGA",
  title: string,
  retryCount = 0,
): Promise<{ media: AniListMedia | null; fallbackUsed: boolean }> {
  const startTime = Date.now();

  try {
    anilistLogger.fetchStarted(malId, type, title);

    const response = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: MEDIA_BY_MAL_QUERY,
        variables: { idMal: malId, type },
      }),
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get("Retry-After");
      anilistLogger.rateLimited(
        retryAfter ? parseInt(retryAfter, 10) * 1000 : undefined,
      );

      if (retryCount < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 5000));
        return fetchAniListMedia(malId, type, title, retryCount + 1);
      }
      return { media: null, fallbackUsed: false };
    }

    if (response.ok) {
      const data = await response.json();
      if (data.data?.Media) {
        const responseTime = Date.now() - startTime;
        anilistLogger.fetchSuccess(
          malId,
          type,
          data.data.Media.id,
          responseTime,
          false,
        );
        return { media: data.data.Media, fallbackUsed: false };
      }
    }

    const searchResponse = await fetch(ANILIST_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        query: SEARCH_BY_TITLE_QUERY,
        variables: { search: title, type },
      }),
    });

    if (searchResponse.ok) {
      const searchData = await searchResponse.json();
      if (searchData.data?.Media) {
        const responseTime = Date.now() - startTime;
        anilistLogger.fetchSuccess(
          malId,
          type,
          searchData.data.Media.id,
          responseTime,
          true,
        );
        return { media: searchData.data.Media, fallbackUsed: true };
      }
    }

    anilistLogger.fetchFailed(
      malId,
      type,
      title,
      "No results from MAL ID or title search",
      retryCount,
    );
    return { media: null, fallbackUsed: false };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    anilistLogger.fetchFailed(malId, type, title, errorMessage, retryCount);

    if (retryCount < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 1000 * (retryCount + 1)));
      return fetchAniListMedia(malId, type, title, retryCount + 1);
    }

    return { media: null, fallbackUsed: false };
  }
}

export const processBatch = internalAction({
  args: {
    jobId: v.id("importJobs"),
    batchIndex: v.number(),
  },
  handler: async (ctx, { jobId, batchIndex }) => {
    const job = await ctx.runQuery(internal.importJobMutations.getJob, {
      jobId,
    });
    if (!job || job.status === "failed" || job.status === "completed") {
      return;
    }

    const startIdx = batchIndex * BATCH_SIZE;
    const endIdx = Math.min(startIdx + BATCH_SIZE, job.items.length);
    const batchItems = job.items.slice(startIdx, endIdx);

    if (batchItems.length === 0) {
      await ctx.runMutation(internal.importJobMutations.completeJob, { jobId });
      return;
    }

    const batchStartTime = Date.now();
    importLogger.batchStarted(
      jobId,
      batchIndex,
      job.totalBatches,
      batchItems.length,
    );

    await ctx.runMutation(internal.importJobMutations.updateJobStatus, {
      jobId,
      status: "processing",
      currentBatch: batchIndex,
    });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];

      if (i > 0) {
        await new Promise((r) => setTimeout(r, ITEM_DELAY_MS));
      }

      const { media } = await fetchAniListMedia(
        item.malId,
        item.type,
        item.title,
      );

      const result = await ctx.runMutation(
        internal.importJobMutations.importSingleItem,
        {
          item,
          anilistData: media
            ? {
                anilistId: media.id,
                title: media.title.romaji,
                titleEnglish: media.title.english ?? undefined,
                coverImage:
                  media.coverImage?.extraLarge ??
                  media.coverImage?.large ??
                  undefined,
                bannerImage: media.bannerImage ?? undefined,
                genres: media.genres,
                format: media.format ?? undefined,
                episodes: media.episodes ?? undefined,
                chapters: media.chapters ?? undefined,
              }
            : undefined,
        },
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    const batchDuration = Date.now() - batchStartTime;
    importLogger.batchCompleted(
      jobId,
      batchIndex,
      successCount,
      failCount,
      batchDuration,
    );

    await ctx.runMutation(internal.importJobMutations.updateProgress, {
      jobId,
      processedItems: endIdx,
      successDelta: successCount,
      failDelta: failCount,
    });

    const nextBatchIndex = batchIndex + 1;
    if (nextBatchIndex * BATCH_SIZE < job.items.length) {
      await ctx.scheduler.runAfter(
        BATCH_DELAY_MS,
        internal.importJob.processBatch,
        {
          jobId,
          batchIndex: nextBatchIndex,
        },
      );
    } else {
      await ctx.runMutation(internal.importJobMutations.completeJob, { jobId });
    }
  },
});

export const refetchFailedCovers = internalAction({
  args: {
    items: v.array(
      v.object({
        mediaItemId: v.id("mediaItems"),
        malId: v.number(),
        type: v.union(v.literal("ANIME"), v.literal("MANGA")),
        title: v.string(),
      }),
    ),
    batchIndex: v.number(),
  },
  handler: async (ctx, { items, batchIndex }) => {
    const REFETCH_BATCH_SIZE = 5;
    const startIdx = batchIndex * REFETCH_BATCH_SIZE;
    const endIdx = Math.min(startIdx + REFETCH_BATCH_SIZE, items.length);
    const batchItems = items.slice(startIdx, endIdx);

    if (batchItems.length === 0) {
      console.log(
        JSON.stringify({
          event: "refetch_completed",
          totalItems: items.length,
        }),
      );
      return;
    }

    console.log(
      JSON.stringify({
        event: "refetch_batch_started",
        batchIndex,
        totalBatches: Math.ceil(items.length / REFETCH_BATCH_SIZE),
        itemCount: batchItems.length,
      }),
    );

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < batchItems.length; i++) {
      const item = batchItems[i];

      if (i > 0) {
        await new Promise((r) => setTimeout(r, ITEM_DELAY_MS));
      }

      const { media } = await fetchAniListMedia(
        item.malId,
        item.type,
        item.title,
      );

      if (media?.coverImage) {
        await ctx.runMutation(
          internal.importJobMutations.updateMediaItemCover,
          {
            mediaItemId: item.mediaItemId,
            anilistId: media.id,
            title: media.title.romaji,
            titleEnglish: media.title.english ?? undefined,
            coverImage:
              media.coverImage.extraLarge ?? media.coverImage.large ?? "",
            bannerImage: media.bannerImage ?? undefined,
            genres: media.genres,
            format: media.format ?? undefined,
            episodes: media.episodes ?? undefined,
            chapters: media.chapters ?? undefined,
          },
        );
        successCount++;
        console.log(
          JSON.stringify({
            event: "refetch_success",
            title: item.title,
            anilistId: media.id,
          }),
        );
      } else {
        failCount++;
        console.log(
          JSON.stringify({
            event: "refetch_failed",
            title: item.title,
            malId: item.malId,
          }),
        );
      }
    }

    console.log(
      JSON.stringify({
        event: "refetch_batch_completed",
        batchIndex,
        successCount,
        failCount,
      }),
    );

    const nextBatchIndex = batchIndex + 1;
    if (nextBatchIndex * REFETCH_BATCH_SIZE < items.length) {
      await ctx.scheduler.runAfter(
        BATCH_DELAY_MS,
        internal.importJob.refetchFailedCovers,
        {
          items,
          batchIndex: nextBatchIndex,
        },
      );
    }
  },
});
