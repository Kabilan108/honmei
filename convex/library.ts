import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Get all AniList IDs in user's library (for checking if items are already added)
export const getAnilistIds = query({
  args: {},
  handler: async (ctx) => {
    const libraryItems = await ctx.db.query("userLibrary").collect();

    const anilistIds = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return media?.anilistId ?? null;
      })
    );

    return anilistIds.filter((id): id is number => id !== null);
  },
});

// Get all items in user's library with media details
export const getAll = query({
  args: {},
  handler: async (ctx) => {
    const libraryItems = await ctx.db
      .query("userLibrary")
      .order("desc")
      .collect();

    // Fetch media details for each library item
    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return {
          ...item,
          media,
        };
      })
    );

    return itemsWithMedia;
  },
});

// Get library items sorted by Elo rating
export const getByElo = query({
  args: {},
  handler: async (ctx) => {
    const libraryItems = await ctx.db
      .query("userLibrary")
      .withIndex("by_elo_rating")
      .order("desc")
      .collect();

    const itemsWithMedia = await Promise.all(
      libraryItems.map(async (item) => {
        const media = await ctx.db.get(item.mediaItemId);
        return {
          ...item,
          media,
        };
      })
    );

    return itemsWithMedia;
  },
});

// Get a single library item by ID
export const getById = query({
  args: { id: v.id("userLibrary") },
  handler: async (ctx, args) => {
    const libraryItem = await ctx.db.get(args.id);
    if (!libraryItem) return null;

    const media = await ctx.db.get(libraryItem.mediaItemId);
    return {
      ...libraryItem,
      media,
    };
  },
});

// Add a media item to the library
export const addToLibrary = mutation({
  args: {
    mediaItemId: v.id("mediaItems"),
    watchStatus: v.union(
      v.literal("COMPLETED"),
      v.literal("WATCHING"),
      v.literal("PLAN_TO_WATCH"),
      v.literal("DROPPED"),
      v.literal("ON_HOLD")
    ),
  },
  handler: async (ctx, args) => {
    // Check if already in library
    const existing = await ctx.db
      .query("userLibrary")
      .withIndex("by_media_item", (q) => q.eq("mediaItemId", args.mediaItemId))
      .first();

    if (existing) {
      throw new Error("Item already in library");
    }

    const now = Date.now();
    const id = await ctx.db.insert("userLibrary", {
      mediaItemId: args.mediaItemId,
      eloRating: 1500, // Starting Elo
      comparisonCount: 0,
      customTags: [],
      watchStatus: args.watchStatus,
      addedAt: now,
      updatedAt: now,
    });

    return id;
  },
});

// Remove from library
export const removeFromLibrary = mutation({
  args: { id: v.id("userLibrary") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// Update library item
export const updateLibraryItem = mutation({
  args: {
    id: v.id("userLibrary"),
    watchStatus: v.optional(
      v.union(
        v.literal("COMPLETED"),
        v.literal("WATCHING"),
        v.literal("PLAN_TO_WATCH"),
        v.literal("DROPPED"),
        v.literal("ON_HOLD")
      )
    ),
    userNotes: v.optional(v.string()),
    customTags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, watchStatus, ...otherUpdates } = args;
    const item = await ctx.db.get(id);

    const updates: Record<string, unknown> = {
      ...otherUpdates,
      updatedAt: Date.now(),
    };

    // If status is being changed
    if (watchStatus !== undefined) {
      updates.watchStatus = watchStatus;

      // Trigger re-ranking comparisons when marked as COMPLETED
      if (watchStatus === "COMPLETED" && item?.watchStatus !== "COMPLETED") {
        updates.needsReranking = true;
      }
    }

    await ctx.db.patch(id, updates);
  },
});
