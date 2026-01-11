# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev      # Start Vite dev server + Convex backend
bun run build    # TypeScript check + Vite production build
bun run lint     # Biome check with auto-fix
bun run preview  # Preview production build
```

Start Convex separately with `npx convex dev` if not running through dev script.

## Architecture

**Curator** is an anime/manga library tracker with Elo-based ranking through pairwise comparisons.

### Stack
- **Frontend**: React 19 + Vite + TailwindCSS v4 + base-ui components
- **Backend**: Convex (serverless database + real-time queries)
- **External API**: AniList GraphQL for media metadata

### Data Flow

```
AniList API → mediaItems (catalog) → userLibrary (user's collection + Elo ratings)
                                   ↓
                            comparisons (history) → Elo calculation → rating updates
```

The `userLibrary` table denormalizes frequently-accessed media fields (`mediaTitle`, `mediaCoverImage`, `mediaGenres`) to avoid joins on every query.

### Key Directories

- `src/pages/` - Route components: HomePage (library grid), ComparePage (Elo comparisons), SearchPage (AniList search), SettingsPage
- `src/components/ui/` - Base UI primitives (base-ui + custom)
- `src/lib/anilist.ts` - AniList GraphQL client with rate-limited batch fetching
- `convex/` - Backend functions: `library.ts`, `comparisons.ts`, `ranking.ts` (smart pair selection), `import.ts`/`importJob.ts` (MAL import)

### Elo System

- Default rating: 1500
- K-factor: 40 for new items, decreases to 16 with more comparisons
- `convex/ranking.ts` - Smart pair selection prioritizes items needing re-ranking, new items, and items due for comparison
- `convex/comparisons.ts` - Records comparisons and updates ratings

### Import System

MAL XML imports are processed in batches via Convex's scheduler:
1. `convex/import.ts` parses XML and creates an import job
2. `convex/importJob.ts` processes items in batches, fetching AniList data for each
3. Progress tracked in `importJobs` table

## Convex Patterns

Queries and mutations are in `convex/*.ts`. Use the generated `api` object:

```tsx
import { api } from "../convex/_generated/api";
const library = useQuery(api.library.getByElo);
const addItem = useMutation(api.library.addToLibrary);
```

Schema defined in `convex/schema.ts` with typed validators.
