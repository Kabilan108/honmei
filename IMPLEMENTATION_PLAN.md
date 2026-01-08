# Curator Implementation Plan

## Overview
This plan implements the full MVP for the anime/manga ELO ranking app based on our feature discussion. Work is structured in phases with explicit parallel tracks where applicable.

---

## Phase 1: UI/UX Polish

### Track A: Global Styling & Theme (UI Agent)
**Files:** `src/index.css`, component files

1. **Remove all rounded corners**
   - Update `src/index.css` to set `--radius: 0` or equivalent
   - Audit all components using `rounded-*` classes
   - Update card components, badges, buttons, inputs to use sharp corners
   - Files: `src/components/ui/*.tsx`, page components

2. **Verify dark mode consistency**
   - Ensure all components respect dark theme
   - Check contrast ratios for accessibility

### Track B: Library Page Restructure (UI Agent)
**Files:** `src/pages/HomePage.tsx`, new components

1. **Implement Anime/Manga tabs**
   - Create tab component at top of library
   - Filter library items by `media.type` (ANIME vs MANGA)
   - Persist tab selection (localStorage or URL param)

2. **Add sorting controls**
   - Dropdown for: Elo Rank, Recently Added, Alphabetical, Comparison Count
   - Add genre filter (multi-select from available genres in library)

3. **Update card display**
   - Show rank position (#1, #2, #3) prominently
   - Show percentile-based score (0-10) instead of raw Elo
   - Display score only when library has 5+ items of that type
   - Visual distinction between anime/manga cards (subtle color coding or icon)

### Track C: Compare Page Redesign (UI Agent)
**Files:** `src/pages/ComparePage.tsx`

1. **Hide ratings during comparison**
   - Remove current rating display from comparison cards
   - Show ratings only AFTER user makes a choice (reveal animation)

2. **Add "Can't Decide" button**
   - Third option below/between the two cards
   - Triggers tie recording (no Elo change)

3. **Add session progress indicator**
   - "Comparison 3 of 5" progress bar
   - "Take a break?" prompt after 5 comparisons

4. **Stats/Insights empty state**
   - When no comparisons needed, show:
     - Total comparisons made
     - Current streak
     - Recent ranking changes
     - "Rankings are stable" message
     - Optional "Fine-tune your top 10?" button

---

## Phase 2: Core Comparison Flow

### Track D: Comparison Algorithm (Backend Agent)
**Files:** `convex/comparisons.ts`, new `convex/ranking.ts`

1. **Implement smart pairing algorithm**
   ```
   For NEW items (comparisonCount < 5):
     - Binary search approach
     - Compare against items at 75th, 50th, 25th percentile
     - Quickly narrow down placement

   For ESTABLISHED items:
     - Compare against items within ±100 Elo
     - Prioritize pairs that haven't been compared recently
   ```

2. **Separate Elo pools by media type**
   - Add `mediaType` consideration to all ranking queries
   - Ensure anime never compared to manga

3. **Implement tie handling**
   - New mutation: `recordTie`
   - Records comparison happened, no Elo change
   - Still increments comparison count

4. **Session management**
   - Track comparisons in current session
   - Return `sessionComplete: true` after 5 comparisons
   - Query: `getComparisonQueue` returns prioritized pairs

### Track E: Scheduling & Triggers (Backend Agent)
**Files:** `convex/schema.ts`, `convex/library.ts`, new `convex/scheduling.ts`

1. **Schema updates**
   - Add to `userLibrary`:
     - `lastComparedAt: v.number()` - timestamp of last comparison
     - `nextComparisonDue: v.optional(v.number())` - for spaced repetition
     - `needsReranking: v.boolean()` - flag for status change trigger

2. **Spaced repetition logic**
   - After comparison, set `nextComparisonDue` based on:
     - New items: sooner (1-2 days)
     - Established items: longer (7-14 days)
     - High uncertainty: sooner

3. **Status change trigger**
   - When `watchStatus` → COMPLETED, set `needsReranking: true`
   - `getComparisonQueue` prioritizes items with this flag

4. **Skip handling**
   - If user skips, delay `nextComparisonDue` by 30-60 minutes
   - Track skip count to avoid pestering

### Track F: Percentile Score Calculation (Backend Agent)
**Files:** `convex/library.ts`

1. **Implement percentile calculation**
   ```typescript
   // For each item, calculate percentile within its type
   percentile = (itemsRankedBelow / totalItems) * 100
   score = percentile / 10  // 0-10 scale
   ```

2. **Add to library queries**
   - `getByElo` returns `rank`, `percentileScore` for each item
   - Only calculate if 5+ items of that type exist

---

## Phase 3: Data Features

### Track G: MAL Import (Full Stack)
**Files:** new `src/pages/ImportPage.tsx`, new `convex/import.ts`

1. **MAL API integration**
   - Research MAL API v2 authentication (OAuth or public endpoints)
   - Fetch user's anime/manga list by username
   - Handle pagination for large libraries

2. **Score mapping**
   ```
   MAL Score → Initial Elo
   10 → 1800
   9  → 1700
   8  → 1600
   7  → 1500 (baseline)
   6  → 1400
   5  → 1300
   4  → 1200
   3  → 1100
   2  → 1000
   1  → 900
   0 (unscored) → 1500
   ```

3. **Import wizard UI**
   - Username input
   - Preview of items to import
   - Progress indicator during import
   - Handle duplicates (skip if already in library)

4. **AniList metadata enrichment**
   - After MAL import, fetch full metadata from AniList
   - Map MAL ID → AniList ID

### Track H: Export & Settings (Full Stack)
**Files:** `src/pages/SettingsPage.tsx`, new `convex/export.ts`

1. **Export functionality**
   - Export library as JSON (full data)
   - Export as CSV (simplified: title, type, elo, rank, score)
   - Trigger browser download

2. **Settings page**
   - MAL import section (link to import wizard)
   - Export buttons
   - Theme toggle (if not auto dark)
   - "Reset all rankings" with confirmation

---

## Phase 4: Gamification & Polish

### Track I: Stats & Gamification
**Files:** new components, `convex/stats.ts`

1. **Streak tracking**
   - Track consecutive days with comparisons
   - Store in new `userStats` table or user preferences

2. **Stats display**
   - Total comparisons (all time)
   - Current streak
   - Longest streak
   - Ranking stability score (% of items with 5+ comparisons)
   - Average comparisons per item

3. **Future: Leaderboards**
   - Weight by library size × comparison count
   - Requires multi-user support (out of scope for MVP)

---

## Parallel Work Matrix

| Phase | Track | Can Run In Parallel With |
|-------|-------|--------------------------|
| 1 | A (Styling) | B, C |
| 1 | B (Library UI) | A, C |
| 1 | C (Compare UI) | A, B |
| 2 | D (Algorithm) | E, F |
| 2 | E (Scheduling) | D, F |
| 2 | F (Percentile) | D, E |
| 3 | G (MAL Import) | H |
| 3 | H (Export/Settings) | G |
| 4 | I (Gamification) | - |

**Optimal parallel execution:**
- Phase 1: 3 agents (UI work is independent)
- Phase 2: 2-3 agents (backend work, some dependencies)
- Phase 3: 2 agents (import and export are independent)
- Phase 4: 1 agent (builds on previous phases)

---

## File Changes Summary

### New Files
- `convex/ranking.ts` - Smart pairing algorithm
- `convex/scheduling.ts` - Spaced repetition logic
- `convex/import.ts` - MAL import mutations
- `convex/export.ts` - Export queries
- `convex/stats.ts` - Gamification stats
- `src/pages/ImportPage.tsx` - Import wizard
- `src/components/LibraryTabs.tsx` - Anime/Manga tabs
- `src/components/StatsPanel.tsx` - Stats display

### Modified Files
- `convex/schema.ts` - New fields for scheduling
- `convex/comparisons.ts` - Smart pairing, tie handling
- `convex/library.ts` - Percentile calculation, type filtering
- `src/pages/HomePage.tsx` - Tabs, sorting, filtering
- `src/pages/ComparePage.tsx` - Hidden ratings, tie button, session flow
- `src/pages/SettingsPage.tsx` - Import/export, settings
- `src/index.css` - Remove rounded corners
- `src/App.tsx` - Add import route

---

## Success Criteria

### Phase 1 Complete When:
- [ ] All corners are sharp (no border-radius anywhere)
- [ ] Library has working Anime/Manga tabs
- [ ] Sorting and genre filtering work
- [ ] Cards show rank # and percentile score (when applicable)

### Phase 2 Complete When:
- [ ] New items get smart binary-search placement
- [ ] Established items compared against similar Elo
- [ ] "Can't decide" ties work correctly
- [ ] Session limits to 5 comparisons
- [ ] Status → COMPLETED triggers re-ranking prompt
- [ ] Spaced repetition scheduling is active

### Phase 3 Complete When:
- [ ] MAL username import works
- [ ] Scores map to initial Elo correctly
- [ ] JSON/CSV export downloads work
- [ ] Settings page is functional

### Phase 4 Complete When:
- [ ] Streak tracking works
- [ ] Stats display on Compare empty state
- [ ] All gamification stats calculate correctly
