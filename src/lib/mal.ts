// MyAnimeList API integration
// Uses Jikan API (unofficial MAL API) for public endpoints

const JIKAN_BASE = "https://api.jikan.moe/v4";

export interface MalAnimeItem {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: {
    jpg: {
      large_image_url: string;
    };
  };
  genres: { name: string }[];
  episodes: number | null;
  score: number | null;
  status: string;
}

export interface MalMangaItem {
  mal_id: number;
  title: string;
  title_english: string | null;
  images: {
    jpg: {
      large_image_url: string;
    };
  };
  genres: { name: string }[];
  chapters: number | null;
  score: number | null;
  status: string;
}

export interface MalUserAnimeEntry {
  node: {
    id: number;
    title: string;
    main_picture?: {
      large: string;
    };
  };
  list_status: {
    status: string;
    score: number;
    num_episodes_watched: number;
  };
}

export interface JikanUserAnimeEntry {
  entry: {
    mal_id: number;
    title: string;
    images: {
      jpg: {
        large_image_url: string;
      };
    };
  };
  score: number;
  episodes_watched: number;
}

export interface JikanUserMangaEntry {
  entry: {
    mal_id: number;
    title: string;
    images: {
      jpg: {
        large_image_url: string;
      };
    };
  };
  score: number;
  chapters_read: number;
}

export interface JikanAnimeResponse {
  data: JikanUserAnimeEntry[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

export interface JikanMangaResponse {
  data: JikanUserMangaEntry[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
  };
}

// Rate limiting helper
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch user's anime list from Jikan
export async function fetchUserAnimeList(
  username: string,
  status?: string
): Promise<{
  items: Array<{
    malId: number;
    title: string;
    coverImage: string;
    score: number;
    status: string;
    episodesWatched: number;
  }>;
  hasMore: boolean;
  error?: string;
}> {
  try {
    // Jikan rate limit: 3 requests per second
    const statusParam = status ? `&status=${status}` : "";
    const response = await fetch(
      `${JIKAN_BASE}/users/${username}/animelist?limit=300${statusParam}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { items: [], hasMore: false, error: "User not found" };
      }
      if (response.status === 429) {
        return { items: [], hasMore: false, error: "Rate limited. Please wait a moment." };
      }
      return { items: [], hasMore: false, error: `API error: ${response.status}` };
    }

    const data: JikanAnimeResponse = await response.json();

    const items = data.data.map((entry) => ({
      malId: entry.entry.mal_id,
      title: entry.entry.title,
      coverImage: entry.entry.images.jpg.large_image_url,
      score: entry.score,
      status: "completed", // Jikan returns by status, so we know it
      episodesWatched: entry.episodes_watched,
    }));

    return {
      items,
      hasMore: data.pagination.has_next_page,
    };
  } catch (error) {
    console.error("Failed to fetch anime list:", error);
    return { items: [], hasMore: false, error: "Network error" };
  }
}

// Fetch user's manga list from Jikan
export async function fetchUserMangaList(
  username: string,
  status?: string
): Promise<{
  items: Array<{
    malId: number;
    title: string;
    coverImage: string;
    score: number;
    status: string;
    chaptersRead: number;
  }>;
  hasMore: boolean;
  error?: string;
}> {
  try {
    const statusParam = status ? `&status=${status}` : "";
    const response = await fetch(
      `${JIKAN_BASE}/users/${username}/mangalist?limit=300${statusParam}`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return { items: [], hasMore: false, error: "User not found" };
      }
      if (response.status === 429) {
        return { items: [], hasMore: false, error: "Rate limited. Please wait a moment." };
      }
      return { items: [], hasMore: false, error: `API error: ${response.status}` };
    }

    const data: JikanMangaResponse = await response.json();

    const items = data.data.map((entry) => ({
      malId: entry.entry.mal_id,
      title: entry.entry.title,
      coverImage: entry.entry.images.jpg.large_image_url,
      score: entry.score,
      status: "completed",
      chaptersRead: entry.chapters_read,
    }));

    return {
      items,
      hasMore: data.pagination.has_next_page,
    };
  } catch (error) {
    console.error("Failed to fetch manga list:", error);
    return { items: [], hasMore: false, error: "Network error" };
  }
}

// Fetch anime details to get genres
export async function fetchAnimeDetails(malId: number): Promise<{
  genres: string[];
  episodes: number | null;
  error?: string;
}> {
  try {
    await delay(350); // Rate limiting
    const response = await fetch(`${JIKAN_BASE}/anime/${malId}`);

    if (!response.ok) {
      return { genres: [], episodes: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return {
      genres: data.data.genres?.map((g: { name: string }) => g.name) ?? [],
      episodes: data.data.episodes,
    };
  } catch (error) {
    return { genres: [], episodes: null, error: "Network error" };
  }
}

// Fetch manga details to get genres
export async function fetchMangaDetails(malId: number): Promise<{
  genres: string[];
  chapters: number | null;
  error?: string;
}> {
  try {
    await delay(350); // Rate limiting
    const response = await fetch(`${JIKAN_BASE}/manga/${malId}`);

    if (!response.ok) {
      return { genres: [], chapters: null, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    return {
      genres: data.data.genres?.map((g: { name: string }) => g.name) ?? [],
      chapters: data.data.chapters,
    };
  } catch (error) {
    return { genres: [], chapters: null, error: "Network error" };
  }
}
