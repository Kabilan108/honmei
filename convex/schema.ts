import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Media items from AniList - the master catalog
  mediaItems: defineTable({
    anilistId: v.number(),
    malId: v.optional(v.number()),
    type: v.union(v.literal("ANIME"), v.literal("MANGA")),

    // Title variants
    title: v.string(),
    titleEnglish: v.optional(v.string()),
    titleJapanese: v.optional(v.string()),

    // Rich metadata from AniList
    description: v.optional(v.string()),
    coverImage: v.string(),
    bannerImage: v.optional(v.string()),

    // Arrays of strings
    genres: v.array(v.string()),
    tags: v.array(v.string()),

    // Media details
    format: v.optional(v.string()), // TV, MOVIE, MANGA, etc.
    status: v.optional(v.string()), // FINISHED, RELEASING, etc.
    episodes: v.optional(v.number()),
    chapters: v.optional(v.number()),

    // Scoring and popularity from AniList
    averageScore: v.optional(v.number()),
    popularity: v.optional(v.number()),

    // Dates as objects (AniList format)
    startDate: v.optional(
      v.object({
        year: v.optional(v.number()),
        month: v.optional(v.number()),
        day: v.optional(v.number()),
      }),
    ),
    endDate: v.optional(
      v.object({
        year: v.optional(v.number()),
        month: v.optional(v.number()),
        day: v.optional(v.number()),
      }),
    ),

    // Franchise grouping (for multi-season series)
    franchiseId: v.optional(v.string()),
  })
    .index("by_anilist_id", ["anilistId"])
    .index("by_mal_id", ["malId"])
    .index("by_type", ["type"])
    .index("by_franchise", ["franchiseId"]),

  // User's personal library - items they're tracking
  userLibrary: defineTable({
    mediaItemId: v.id("mediaItems"),

    // Multi-user support (nullable until auth implemented)
    userId: v.optional(v.string()),

    // Denormalized from mediaItems for query performance
    mediaTitle: v.string(),
    mediaCoverImage: v.string(),
    mediaBannerImage: v.optional(v.string()),
    mediaType: v.union(v.literal("ANIME"), v.literal("MANGA")),
    mediaGenres: v.array(v.string()),

    // Glicko-2 rating system
    rating: v.number(), // Glicko-2 rating (default: 1500)
    rd: v.number(), // Rating Deviation (default: 350)
    volatility: v.number(), // Volatility σ (default: 0.06)

    // Comparison statistics (denormalized for O(1) access)
    comparisonCount: v.number(),
    totalWins: v.number(),
    totalLosses: v.number(),
    totalTies: v.number(),

    // User's custom tags
    customTags: v.array(v.string()),

    // Watch/read status
    watchStatus: v.union(
      v.literal("COMPLETED"),
      v.literal("WATCHING"),
      v.literal("PLAN_TO_WATCH"),
      v.literal("DROPPED"),
      v.literal("ON_HOLD"),
    ),

    // Personal notes
    userNotes: v.optional(v.string()),

    // Custom title override (user can rename items)
    customTitle: v.optional(v.string()),

    // Comparison scheduling
    lastComparedAt: v.optional(v.number()),
    nextComparisonDue: v.optional(v.number()),
    needsReranking: v.optional(v.boolean()),

    // Timestamps
    addedAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_media_item", ["mediaItemId"])
    .index("by_rating", ["rating"])
    .index("by_rd", ["rd"])
    .index("by_watch_status", ["watchStatus"])
    .index("by_added_at", ["addedAt"])
    .index("by_next_comparison", ["nextComparisonDue"])
    .index("by_media_type", ["mediaType"])
    .index("by_media_type_and_rd", ["mediaType", "rd"])
    .index("by_user", ["userId"]),

  // Comparison history for rating calculations
  comparisons: defineTable({
    // Multi-user support (nullable until auth implemented)
    userId: v.optional(v.string()),

    winnerId: v.id("userLibrary"),
    loserId: v.id("userLibrary"),
    isTie: v.optional(v.boolean()), // True if user couldn't decide
    createdAt: v.number(),
  })
    .index("by_winner", ["winnerId"])
    .index("by_loser", ["loserId"])
    .index("by_created_at", ["createdAt"])
    .index("by_user", ["userId"]),

  // Track comparison pairs for duplicate prevention
  comparisonPairs: defineTable({
    // Multi-user support (nullable until auth implemented)
    userId: v.optional(v.string()),

    // Items are stored with itemA._id < itemB._id for consistent lookup
    itemA: v.id("userLibrary"),
    itemB: v.id("userLibrary"),

    // How many times this pair has been compared
    comparisonCount: v.number(),

    // When this pair was last compared
    lastComparedAt: v.number(),
  })
    .index("by_items", ["itemA", "itemB"])
    .index("by_user", ["userId"])
    .index("by_last_compared", ["lastComparedAt"]),

  // Custom fields definition
  customFields: defineTable({
    fieldName: v.string(),
    fieldType: v.union(
      v.literal("TEXT"),
      v.literal("NUMBER"),
      v.literal("SELECT"),
      v.literal("MULTI_SELECT"),
      v.literal("DATE"),
      v.literal("RATING"),
    ),
    // For SELECT and MULTI_SELECT types
    options: v.optional(v.array(v.string())),
    createdAt: v.number(),
  })
    .index("by_field_name", ["fieldName"])
    .index("by_created_at", ["createdAt"]),

  // Custom field values for library items
  customFieldValues: defineTable({
    userLibraryId: v.id("userLibrary"),
    customFieldId: v.id("customFields"),

    // Value stored as string, number, or array based on field type
    // We'll use a union to handle different types
    valueText: v.optional(v.string()),
    valueNumber: v.optional(v.number()),
    valueArray: v.optional(v.array(v.string())),
  })
    .index("by_user_library", ["userLibraryId"])
    .index("by_custom_field", ["customFieldId"])
    .index("by_user_library_and_field", ["userLibraryId", "customFieldId"]),

  // Aggregated user stats - singleton table for O(1) stats reads
  userStats: defineTable({
    // Multi-user support (nullable until auth implemented)
    userId: v.optional(v.string()),

    // Comparison stats
    totalComparisons: v.number(),
    tieCount: v.number(),

    // Library counts (to avoid O(n) scans) - optional during migration
    animeCount: v.optional(v.number()),
    mangaCount: v.optional(v.number()),
    rankedAnimeCount: v.optional(v.number()), // Items with RD <= threshold
    rankedMangaCount: v.optional(v.number()),

    // Streak tracking
    currentStreak: v.number(),
    longestStreak: v.number(),
    // Last comparison date (midnight timestamp) for streak tracking
    lastComparisonDate: v.optional(v.number()),

    // Rolling 7-day window for activity chart
    last7Days: v.array(
      v.object({
        date: v.number(), // midnight timestamp
        count: v.number(),
      }),
    ),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  // Import jobs for tracking MAL import progress
  importJobs: defineTable({
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed"),
    ),

    // Items to import (stored as JSON array)
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

    // Progress tracking
    totalItems: v.number(),
    processedItems: v.number(),
    successCount: v.number(),
    failCount: v.number(),
    currentBatch: v.number(),
    totalBatches: v.number(),

    // Timing
    startedAt: v.number(),
    completedAt: v.optional(v.number()),

    // Error info if failed
    error: v.optional(v.string()),
  }).index("by_status", ["status"]),
});
