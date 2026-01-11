# UI Refinements

## Priority 1: Critical UX Fixes

### 1.1 Item Detail View
**Status:** Ready to implement

Add a detail view that shows comprehensive item information:
- **Mobile:** Bottom sheet/tray that slides up from bottom
- **Desktop:** Modal dialog (AlertDialog pattern from shadcn)

Content to display:
- Full synopsis/description
- All genres and tags
- Publishing/airing status
- Watch status (editable)
- Elo rating and comparison stats

Implementation:
- Create `MediaDetailSheet.tsx` component using shadcn's Dialog (desktop) and Drawer (mobile)
- Use media query or viewport detection to choose presentation
- Make watch status editable via dropdown in the detail view

### 1.2 Library Card Click Behavior
**Status:** Ready to implement

Current: Clicking anywhere on card opens remove confirmation dialog
Target:
- Card body click → Opens detail view
- Remove button (trash icon) → Visible on hover, opens remove dialog

Changes to `LibraryCard.tsx`:
- Remove `AlertDialogTrigger` wrapping the entire card
- Add `onClick` handler to card that opens detail view
- Keep trash button with hover visibility (`opacity-0 group-hover:opacity-100`)

### 1.3 Watch Status Editable from Cards
**Status:** Ready to implement

Add ability to cycle through statuses by clicking the status badge on library cards:
- Click/tap on status badge → Cycle to next status
- Visual feedback on interaction (subtle animation)
- Order: Completed → Watching/Reading → Plan to Watch → On Hold → Dropped → Completed

### 1.4 Status Terminology (Watching → Reading for Manga)
**Status:** Ready to implement

Update `LibraryCard.tsx` to make status labels media-type aware:
- Pass `mediaType` prop to status display logic
- Use "Reading" instead of "Watching" for manga
- Use "Plan to Read" instead of "Plan to Watch" for manga

```tsx
const getStatusLabel = (status: WatchStatus, mediaType: MediaType) => {
  if (mediaType === "MANGA") {
    switch (status) {
      case "WATCHING": return "Reading";
      case "PLAN_TO_WATCH": return "Plan to Read";
      default: return statusConfig[status].label;
    }
  }
  return statusConfig[status].label;
};
```

### 1.5 Add All Status Options to Search Add Dropdown
**Status:** Ready to implement

Add missing status options to `StatusPicker` in `SearchResultCard.tsx`:
- Watching/Reading
- Completed
- Plan to Watch/Read
- On Hold
- Dropped

**Rankability rules:**
- **Rankable:** Completed, Watching/Reading, On Hold
- **Not rankable:** Plan to Watch/Read, Dropped

Update comparison query to filter out Plan to Watch and Dropped items.

---

## Priority 2: Data & Content Fixes

### 2.1 Standardize Display Names to English
**Status:** Ready to implement

Use English titles when available for better recognition:
- Primary display: `titleEnglish` (if available) → fallback to `title` (romaji)
- Show romaji as subtitle/secondary text
- Apply across: Library cards, Search results, Compare cards, Detail view

Changes:
- Update `LibraryCard.tsx` to prefer English title
- Update `ComparisonCard.tsx` to prefer English title
- Store both titles in media record for user reference

### 2.2 User-Editable Metadata in Detail View
**Status:** Ready to implement

Allow users to edit media metadata after initial fetch:
- Title (custom override)
- Watch status
- Personal notes (new field?)

Implementation:
- Add edit mode to detail view
- Mutation to update user's library entry metadata
- Store user overrides separately from canonical data

### 2.3 Investigate Empty Badges in Search Results
**Status:** Needs investigation

Some search results show empty/broken badge areas after type badge.

Investigation steps:
1. Add console.log in `SearchResultCard.tsx` to log `media.format` and `media.status`
2. Search for items that show broken badges
3. Check AniList API response for those items
4. Determine if issue is null values, empty strings, or rendering logic

### 2.4 Add Tooltips for Long Titles
**Status:** Ready to implement

Add `title` attribute to truncated title elements:
- Library cards
- Comparison cards
- Search result cards

```tsx
<h3 className="line-clamp-2" title={item.mediaTitle}>
  {item.mediaTitle}
</h3>
```

### 2.5 Multi-Season Anime Handling
**Status:** Ready to implement (Phase 1: Schema only)

**Decision:** Keep current behavior (separate entries per season) but prepare for future franchise grouping.

Implementation:
1. Add optional `franchiseId?: string` field to media schema
2. No changes to import behavior for now
3. Future: Use AniList relations API to detect prequels/sequels and auto-assign franchiseId

This allows us to add visual grouping later without data migration.

---

## Priority 3: Theme & Styling

### 3.1 Add Border Radius via CSS Variable
**Status:** Ready to implement

Change `--radius: 0` to a subtle value in `index.css`:

```css
:root {
  --radius: 0.375rem; /* or 0.5rem for slightly more rounded */
}
```

This single change propagates to all shadcn components via the existing Tailwind theme.

### 3.2 Fix Accent Color Theme Switching
**Status:** Needs investigation

Bug: When switching accent colors, tags become dark orange on black regardless of selected color.

Investigation steps:
1. Check how accent color switching works in Settings
2. Verify CSS variables are being updated correctly
3. Check if badge/tag components use hardcoded colors instead of CSS variables
4. Test each accent color and document which elements don't update

### 3.3 Desktop Sidebar / Mobile Bottom Nav
**Status:** Ready to implement

Current: Bottom navigation bar on all screen sizes
Target:
- Mobile (< 768px): Keep bottom navigation
- Desktop (>= 768px): Sidebar navigation

Implementation:
- Reference shadcn sidebar guide: https://ui.shadcn.com/docs/components/sidebar
- Create responsive layout wrapper
- Sidebar items: Library, Search, Compare, Settings
- Maintain consistent styling with current theme

---

## Priority 4: Loading States & Transitions

### 4.1 Add Skeleton Loaders
**Status:** Ready to implement

Add skeleton loading states for:
- Library grid (card-shaped skeletons)
- Search results (result card skeletons)
- Compare page (comparison card skeletons)
- Stats panel

Use shadcn's Skeleton component pattern.

### 4.2 Add Page Transitions
**Status:** Ready to implement

Add subtle transitions between pages/states:
- Fade transitions for page content
- Smooth card hover effects (subtle lift/shadow)
- Compare card selection feedback

Keep animations fast (150-200ms) to maintain snappy feel.

---

## Priority 5: Mobile Comparison UI

### 5.1 Compact Comparison Cards on Mobile
**Status:** Ready to implement

**Decision:** Use overlay text design on mobile.

Design:
- Cover image fills card
- Gradient overlay at bottom (black → transparent)
- Title, type badge, genres, rating overlaid on gradient
- Both cards visible without scrolling on mobile

```
┌───────────────────────────┐
│                           │
│      [Cover Image]        │
│                           │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ← gradient
│ Steins;Gate               │
│ ANIME · Drama · Sci-Fi    │
│ Rating: ???  Comps: 0     │
└───────────────────────────┘
```

Implementation:
- Create mobile-specific comparison card variant
- Use `md:` breakpoint to switch between compact (mobile) and full (desktop)
- Gradient: `bg-gradient-to-t from-black/90 via-black/50 to-transparent`

---

## Implementation Order

### Phase 1 - Core UX (Issues 1.1-1.5)
- [ ] 1.1 Detail view with bottom sheet (mobile) / modal (desktop)
- [ ] 1.2 Card click behavior fix (click → details, hover → remove)
- [ ] 1.3 Status editing from cards (click badge to cycle)
- [ ] 1.4 Status terminology fix (Watching → Reading for manga)
- [ ] 1.5 All status options in add dropdown + rankability filter

### Phase 2 - Content & Data (Issues 2.1-2.5)
- [ ] 2.1 English title preference across all views
- [ ] 2.2 Editable metadata in detail view
- [ ] 2.3 Investigate & fix empty badges in search
- [ ] 2.4 Tooltips for truncated titles
- [ ] 2.5 Add franchiseId field to schema (prep for future)

### Phase 3 - Theme & Layout (Issues 3.1-3.3)
- [ ] 3.1 Border radius via CSS variable
- [ ] 3.2 Fix accent color theme switching bug
- [ ] 3.3 Desktop sidebar / mobile bottom nav

### Phase 4 - Polish (Issues 4.1-4.2, 5.1)
- [ ] 4.1 Skeleton loaders for all loading states
- [ ] 4.2 Page transitions and hover effects
- [ ] 5.1 Compact comparison cards on mobile (overlay design)
