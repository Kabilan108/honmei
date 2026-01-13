# Ranking System Refinements Spec

This document outlines the implementation plan for improving the ELO-based ranking system,
migrating to Glicko-2, and addressing UX issues identified during review.

## Overview

### Current State
- Basic ELO with linear K-factor decay
- No duplicate comparison prevention
- Ties increment count but don't affect ratings
- Session-based comparison flow (5 per session)
- No confidence threshold for rankings
- Statistics have O(n) queries disguised as O(1)

### Target State
- Glicko-2 rating system with RD-based confidence
- Duplicate comparison prevention via pair tracking
- Proper tie handling (draws affect ratings)
- Continuous comparison flow until exhausted
- Ranked/unranked split based on RD threshold
- True O(1) statistics queries
- Multi-user ready schema (auth added later)

---

## Constants ✅

All tunable constants are defined in `convex/lib/constants.ts`:

```typescript
// Glicko-2 Parameters
export const GLICKO_DEFAULT_RATING = 1500;
export const GLICKO_DEFAULT_RD = 350;
export const GLICKO_DEFAULT_VOLATILITY = 0.06;
export const GLICKO_TAU = 0.5;
export const GLICKO_SCALING_FACTOR = 173.7178;

// Confidence Thresholds
export const RD_CONFIDENCE_THRESHOLD = 200; // Items with RD > this are "unranked"

// Comparison Scheduling
export const COMPARISON_RESURFACE_DAYS_NEW = 1; // Days before new item resurfaces
export const COMPARISON_RESURFACE_DAYS_ESTABLISHED = 3; // Days for established items

// UI Thresholds
export const UNRANKED_NOTIFICATION_THRESHOLD = 3; // Show badge when this many unranked

// Archival
export const COMPARISON_RETENTION_DAYS = 90;
```

---

## Phase 1: Backend - Glicko-2 Implementation

### 1.1 Vendor Glicko-2 Algorithm
- [x] Create `convex/lib/glicko2.ts` based on [mmai/glicko2js](https://github.com/mmai/glicko2js)
- [x] Convert to TypeScript with proper types
- [x] Implement core functions:
  - [x] `calculateG(rd)` - uncertainty adjustment
  - [x] `calculateE(rating, opponentRating, opponentRd)` - expected outcome
  - [x] `calculateVariance(opponents)` - rating variance
  - [x] `calculateDelta(variance, opponents)` - expected improvement
  - [x] `calculateNewVolatility(sigma, delta, variance, tau)` - volatility update
  - [x] `updateRating(player, opponents)` - main update function
- [x] Add support for ties (expected score = 0.5)
- [ ] Write unit tests for algorithm

### 1.2 Update Schema
- [x] Modify `userLibrary` table:
  ```typescript
  // Replace eloRating with Glicko-2 fields
  rating: v.number(),           // Glicko-2 rating (default 1500)
  rd: v.number(),               // Rating Deviation (default 350)
  volatility: v.number(),       // Volatility σ (default 0.06)

  // Denormalized comparison stats
  totalWins: v.number(),
  totalLosses: v.number(),
  totalTies: v.number(),

  // Keep existing
  comparisonCount: v.number(),
  lastComparedAt: v.optional(v.number()),
  nextComparisonDue: v.optional(v.number()),
  needsReranking: v.optional(v.boolean()),

  // Multi-user ready (nullable until auth implemented)
  userId: v.optional(v.string()),
  ```

- [x] Add `comparisonPairs` table:
  ```typescript
  comparisonPairs: defineTable({
    userId: v.optional(v.string()),
    itemA: v.id("userLibrary"),  // Always smaller ID
    itemB: v.id("userLibrary"),  // Always larger ID
    comparisonCount: v.number(),
    lastComparedAt: v.number(),
  })
    .index("by_items", ["itemA", "itemB"])
    .index("by_user", ["userId"])
  ```

- [x] Update `userStats` singleton:
  ```typescript
  // Add counts to avoid O(n) queries
  animeCount: v.number(),
  mangaCount: v.number(),
  rankedAnimeCount: v.number(),
  rankedMangaCount: v.number(),
  ```

### 1.3 Update Comparison Recording
- [x] Modify `recordComparison` mutation:
  - [x] Use Glicko-2 algorithm for rating updates
  - [x] Update RD and volatility for both items
  - [x] Increment win/loss stats on items
  - [x] Upsert into `comparisonPairs` table
  - [x] Handle ties properly (score = 0.5 for both)
- [x] Modify `recordTie` mutation:
  - [x] Apply Glicko-2 with expected score 0.5
  - [x] Update stats (increment ties)

### 1.4 Update Smart Pairing
- [x] Modify `findSmartPair` to:
  - [ ] Check `comparisonPairs` to avoid recent duplicates
  - [x] Prioritize high-RD items (uncertain ratings)
  - [x] Use RD instead of comparisonCount for "new item" detection
- [ ] Add helper `hasBeenComparedRecently(itemA, itemB)`:
  - [ ] Query `comparisonPairs` for this pair
  - [ ] Return true if compared within last 7 days (configurable)

### 1.5 Filter by Watch Status
- [x] Modify queries to exclude `PLAN_TO_WATCH` items from comparisons
- [x] Include: COMPLETED, WATCHING, ON_HOLD, DROPPED

---

## Phase 2: Backend - Statistics & Performance

### 2.1 Fix Statistics Aggregation
- [x] Remove `getUserStats` query (O(n) scan)
- [x] Update `getAggregatedStats` to use denormalized counts from `userStats`
- [x] Remove `calculateStability` function (replaced by RD)
- [x] Update `updateStatsAfterComparison`:
  - [x] Increment/decrement anime/manga counts when items added/removed
  - [x] Track ranked counts based on RD threshold

### 2.2 Add Efficient Queries
- [x] Add `getUnrankedCount(mediaType)` - dedicated query using compound index
- [x] Add `getRankedItems(mediaType)` - uses compound index, sorted by rating
- [x] Add `getUnrankedItems(mediaType)` - uses compound index, sorted by RD desc
- [x] Use index on RD for efficient filtering

### 2.3 Optimize Pairing Query
- [x] Add compound index `by_media_type_and_rd` for efficient unranked item lookup
- [x] Use `nextComparisonDue` index as priority queue (index exists)

---

## Phase 3: Frontend - Comparison UX

### 3.1 Fix Skip Button
- [x] Modify `handleSkip` to fetch new pair (not just clear state)
- [x] Track skipped pairs to avoid showing again in session

### 3.2 Improve Rating Feedback
- [x] Show rating changes BEFORE transitioning to next pair
  - Fixed by freezing displayed pair during results phase
- [x] Add animation for rating delta display (fade-in)
- [x] Add visual feedback for winner/loser:
  - Winner: green border, elevated shadow, raised effect
  - Loser: dimmed opacity, muted border
  - Tie: primary accent border, slightly elevated, slightly dimmed
- [x] Auto-advance after 2.5s timeout (removed Continue button for better flow)

### 3.3 Add Undo Capability
- [x] Single-undo only (not a stack) - can only undo the most recent comparison
- [x] Store last comparison result in state (items, old ratings, new ratings)
- [x] Add "Undo" button in bottom row with Can't Decide/Skip
  - Only visible when there's something to undo
  - Clears when: making another comparison, skipping, or switching media type
- [x] Create `undoComparison` mutation:
  - [x] Reverse rating changes (restore old ratings, RD, volatility)
  - [x] Decrement comparison counts and win/loss/tie stats
  - [x] Decrement `comparisonPairs` count (or remove if count becomes 0)
  - [x] Delete the comparison record from `comparisons` table

### 3.4 Remove Session Limit
- [x] Remove `SESSION_LIMIT` constant and session count tracking
- [x] Show continuous comparisons until:
  - [x] No valid pairs available (all compared recently)
  - [x] All items are well-ranked (low RD)
- [x] Display "All caught up!" state with:
  - [x] Celebration emoji and message
  - [x] Option to "Review skipped pairs" if any
  - [x] Stats panel showing overall progress

### 3.5 Add Context to Comparison Cards
- [x] Add year released
- [x] Add episode count (anime) / chapter count (manga)
- [x] Add watch status badge
- [x] Do NOT show external scores (MAL/AniList) to avoid bias

---

## Phase 4: Frontend - Library UX ✅

### 4.1 Unified Grid View (replaces sub-tabs)
- [x] Single grid view instead of Ranked/Unranked sub-tabs
- [x] Ranked items appear first (sorted by user's selected sort option)
- [x] Unranked items appear at bottom (always sorted by RD ascending)
- [x] Subtle separator with "Unranked — needs more comparisons" label
- [x] CTA banner at top when unranked items exist: "X items need more comparisons [Compare]"

### 4.2 Unranked Card Styling
- [x] 75% opacity on unranked cards
- [x] Show "?" instead of score badge
- [x] Hide rank badge (#1, #2, etc.) on unranked cards
- [x] Same grid layout as ranked items (not a separate list view)

### 4.3 Navigation Badge
- [x] Amber dot on "Compare" nav item when unranked count >= 3
- [x] Shows on both desktop sidebar and mobile bottom nav
- [x] Updates in real-time (queries library directly, not stats table)

---

## Phase 5: Backend - Data Integrity ✅

### 5.1 Comparison Archival
- [x] Create scheduled job `archiveOldComparisons`:
  - [x] Run daily at 3:00 AM UTC via `convex/crons.ts`
  - [x] Delete comparisons older than `COMPARISON_RETENTION_DAYS` (90 days)
  - [x] Log count of archived records

### 5.2 RD Decay Over Time
- [x] Create scheduled job `decayRatings`:
  - [x] Run daily at 3:30 AM UTC via `convex/crons.ts`
  - [x] Increase RD for items not compared in last 24 hours
  - [x] Formula: `newRd = min(350, sqrt(rd^2 + RD_DECAY_PER_DAY^2))`
  - [x] Configurable via `RD_DECAY_PER_DAY` constant (default: 5)

### 5.3 Migration Script
- [x] ~~Create one-time migration `migrateToGlicko2`~~ - SKIPPED: User chose dump/reimport approach instead of migration

---

## Phase 6: Future - Multi-User & Polish

### 6.1 Prepare for Auth
- [x] Add `userId` field to all relevant tables (nullable for now)
- [ ] ~~Update queries to filter by userId when present~~ SKIPPED: Will handle auth integration in one step later
- [ ] ~~Document where auth checks will be added~~ SKIPPED

### 6.2 Create GitHub Issue for Scalability ✅
- [x] Created issue #8: [Scalability: Optimize queries for 1000+ items](https://github.com/Kabilan108/curator/issues/8)

### 6.3 Comparison History UI ✅
- [x] Created issue #9: [Feature: Comparison history visualization](https://github.com/Kabilan108/curator/issues/9)

---

## Testing Checklist

### Unit Tests
- [ ] Glicko-2 algorithm produces correct ratings
- [ ] Tie handling gives expected 0.5 score
- [ ] RD decreases with comparisons
- [ ] RD increases with time decay
- [ ] Duplicate pair prevention works

### Integration Tests
- [ ] Full comparison flow updates all tables correctly
- [ ] Undo reverses all changes
- [ ] Migration preserves relative rankings
- [ ] Statistics stay in sync

### Manual Testing
- [ ] Compare several items, verify ratings change appropriately
- [ ] Verify unified grid shows ranked items first, unranked at bottom
- [ ] Verify unranked cards: 75% opacity, "?" badge, no rank number
- [ ] Verify CTA banner appears when unranked items exist
- [ ] Verify navigation badge (amber dot) appears/disappears correctly
- [ ] Test on mobile viewport

---

## Implementation Order

1. ~~**Phase 1.1-1.2**: Glicko-2 algorithm and schema (foundation)~~ ✅
2. ~~**Phase 1.3-1.5**: Update mutations and queries~~ ✅
3. ~~**Phase 5.3**: Migration script~~ SKIPPED (dump/reimport approach)
4. ~~**Phase 3.1-3.2**: Fix skip button and rating feedback~~ ✅
5. ~~**Phase 2.1-2.3**: Statistics and performance fixes~~ ✅
6. ~~**Phase 4.1-4.3**: Library UX (unified grid, unranked styling, nav badge)~~ ✅
7. ~~**Phase 3.3-3.4**: Undo and remove session limit~~ ✅
8. ~~**Phase 3.5**: Additional card context~~ ✅
9. ~~**Phase 5.1-5.2**: Archival and decay jobs~~ ✅
10. ~~**Phase 6**: Multi-user prep and cleanup~~ ✅ (6.1 deferred, 6.2/6.3 issues created)

---

## Open Questions

1. **Season handling**: How to treat anime seasons (separate entries vs grouped)?
   - Deferred: Solve organizational problem before tracking episode progress
   - Schema has `franchiseId` field for future grouping

2. **Comparison history UI**: What visualization would be compelling?
   - Deferred: Consider bracket-style view later

3. **Auth provider**: Convex built-in vs Clerk?
   - Decision: Use Convex built-in auth
   - Implementation: After prototype is stable

---

## Deferred

Low-priority items that can be revisited later if needed.

### Optimistic UI for Comparisons
- Calculate expected rating change client-side
- Show immediately while mutation runs
- Reconcile with actual result
- **Status**: Not needed - mutation latency is acceptable (~100-200ms)

### Comparison History Visualization
- Bracket-style view showing comparison paths
- Per-item comparison history
- **Status**: Parking for later based on user demand

---

## References

- [Glicko-2 Official Paper](https://www.glicko.net/glicko/glicko2.pdf)
- [glicko2js Implementation](https://github.com/mmai/glicko2js)
- [Glicko-2 Implementation Guide](https://gist.github.com/gpluscb/302d6b71a8d0fe9f4350d45bc828f802)
