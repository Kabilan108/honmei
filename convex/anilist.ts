"use node";

import { v } from "convex/values";
import { action } from "./_generated/server";

const ANILIST_API_URL = "https://graphql.anilist.co";

// Query to find media by MAL ID
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

// Query to search by title (used as fallback)
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

// Lookup media by MAL ID with title fallback
async function fetchAniListMedia(
  malId: number,
  type: "ANIME" | "MANGA",
  title?: string
): Promise<AniListMedia | null> {
  try {
    // First try MAL ID lookup
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

    if (response.ok) {
      const data = await response.json();
      if (data.data?.Media) {
        return data.data.Media;
      }
    }

    // If MAL ID lookup failed and we have a title, try searching by title
    if (title) {
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
          return searchData.data.Media;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`Failed to fetch AniList data for MAL ID ${malId}:`, error);
    return null;
  }
}

// Batch fetch multiple media items by MAL IDs
export const batchFetchAniListData = action({
  args: {
    items: v.array(
      v.object({
        malId: v.number(),
        type: v.union(v.literal("ANIME"), v.literal("MANGA")),
        title: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const results: Record<
      string,
      {
        anilistId: number;
        title: string;
        titleEnglish: string | null;
        coverImage: string | null;
        bannerImage: string | null;
        genres: string[];
        format: string | null;
        episodes: number | null;
        chapters: number | null;
      } | null
    > = {};

    const BATCH_SIZE = 3;
    const DELAY_MS = 700; // Be conservative with rate limiting

    for (let i = 0; i < args.items.length; i += BATCH_SIZE) {
      const batch = args.items.slice(i, i + BATCH_SIZE);

      // Fetch batch concurrently
      const promises = batch.map(async (item) => {
        const key = `${item.type}-${item.malId}`;
        const media = await fetchAniListMedia(item.malId, item.type, item.title);

        if (media) {
          results[key] = {
            anilistId: media.id,
            title: media.title.romaji,
            titleEnglish: media.title.english,
            coverImage: media.coverImage?.extraLarge || media.coverImage?.large || null,
            bannerImage: media.bannerImage,
            genres: media.genres,
            format: media.format,
            episodes: media.episodes,
            chapters: media.chapters,
          };
        } else {
          results[key] = null;
        }
      });

      await Promise.all(promises);

      // Rate limit delay between batches
      if (i + BATCH_SIZE < args.items.length) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }
    }

    return results;
  },
});
