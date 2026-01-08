const ANILIST_API_URL = "https://graphql.anilist.co";

export interface AniListMedia {
  id: number;
  idMal: number | null;
  type: "ANIME" | "MANGA";
  title: {
    romaji: string;
    english: string | null;
    native: string | null;
  };
  description: string | null;
  coverImage: {
    large: string;
    extraLarge: string;
  };
  bannerImage: string | null;
  genres: string[];
  tags: Array<{
    name: string;
    rank: number;
  }>;
  format: string | null;
  status: string | null;
  episodes: number | null;
  chapters: number | null;
  averageScore: number | null;
  popularity: number | null;
  startDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
  endDate: {
    year: number | null;
    month: number | null;
    day: number | null;
  };
}

interface AniListSearchResponse {
  data: {
    Page: {
      media: AniListMedia[];
      pageInfo: {
        total: number;
        currentPage: number;
        lastPage: number;
        hasNextPage: boolean;
      };
    };
  };
}

interface AniListMediaResponse {
  data: {
    Media: AniListMedia;
  };
}

const SEARCH_QUERY = `
  query ($page: Int, $perPage: Int, $search: String, $type: MediaType) {
    Page(page: $page, perPage: $perPage) {
      pageInfo {
        total
        currentPage
        lastPage
        hasNextPage
      }
      media(search: $search, type: $type, sort: POPULARITY_DESC) {
        id
        idMal
        type
        title {
          romaji
          english
          native
        }
        description
        coverImage {
          large
          extraLarge
        }
        bannerImage
        genres
        tags {
          name
          rank
        }
        format
        status
        episodes
        chapters
        averageScore
        popularity
        startDate {
          year
          month
          day
        }
        endDate {
          year
          month
          day
        }
      }
    }
  }
`;

const MEDIA_QUERY = `
  query ($id: Int) {
    Media(id: $id) {
      id
      idMal
      type
      title {
        romaji
        english
        native
      }
      description
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      tags {
        name
        rank
      }
      format
      status
      episodes
      chapters
      averageScore
      popularity
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
    }
  }
`;

export async function searchAniList(
  searchTerm: string,
  type?: "ANIME" | "MANGA",
  page: number = 1,
  perPage: number = 20
): Promise<AniListSearchResponse["data"]["Page"]> {
  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: SEARCH_QUERY,
      variables: {
        search: searchTerm,
        type,
        page,
        perPage,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.statusText}`);
  }

  const data: AniListSearchResponse = await response.json();
  return data.data.Page;
}

export async function getAniListMedia(id: number): Promise<AniListMedia> {
  const response = await fetch(ANILIST_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      query: MEDIA_QUERY,
      variables: { id },
    }),
  });

  if (!response.ok) {
    throw new Error(`AniList API error: ${response.statusText}`);
  }

  const data: AniListMediaResponse = await response.json();
  return data.data.Media;
}

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
      description
      coverImage {
        large
        extraLarge
      }
      bannerImage
      genres
      tags {
        name
        rank
      }
      format
      status
      episodes
      chapters
      averageScore
      popularity
      startDate {
        year
        month
        day
      }
      endDate {
        year
        month
        day
      }
    }
  }
`;

// Lookup media by MAL ID
export async function getAniListMediaByMalId(
  malId: number,
  type: "ANIME" | "MANGA"
): Promise<AniListMedia | null> {
  try {
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

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data.data?.Media || null;
  } catch {
    return null;
  }
}

// Batch fetch multiple media items by MAL IDs with rate limiting
// AniList rate limit is 90 requests per minute, so we batch and add delays
export async function batchFetchByMalIds(
  items: Array<{ malId: number; type: "ANIME" | "MANGA" }>,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, AniListMedia>> {
  const results = new Map<string, AniListMedia>();
  const BATCH_SIZE = 5; // Concurrent requests per batch
  const DELAY_MS = 350; // Delay between batches to stay under rate limit

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);

    // Fetch batch concurrently
    const promises = batch.map(async (item) => {
      const key = `${item.type}-${item.malId}`;
      const media = await getAniListMediaByMalId(item.malId, item.type);
      if (media) {
        results.set(key, media);
      }
      return media;
    });

    await Promise.all(promises);

    // Report progress
    if (onProgress) {
      onProgress(Math.min(i + BATCH_SIZE, items.length), items.length);
    }

    // Rate limit delay between batches (skip on last batch)
    if (i + BATCH_SIZE < items.length) {
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }

  return results;
}
