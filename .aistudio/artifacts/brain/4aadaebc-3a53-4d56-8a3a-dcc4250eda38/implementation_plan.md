# Implementation Plan: Discover Tag Reset, Contextual Trending Topics & Quality Ranking Algorithm

Refine the Discover and Communities navigation to automatically reset active tags when switching to Discover, transform Trending Topics to extract tags dynamically from loaded posts (filtered for spam/low-effort tags), and implement a custom ranking algorithm for Hot and Trending feeds with a strict 10+ comments requirement and auto-fetching.

---

## User Requirements & Clarifications Summary
1. **Discover Tag Reset**:
   - When switching from Communities or any filtered view to Discover, active community or topic tags must be cleared immediately so Discover starts in the clean "All Topics" global view.
2. **Contextual Trending Topics**:
   - Extract tags solely from the currently loaded posts rather than global Hive RPC calls.
   - Maintain a robust spam tag blacklist (e.g., `pob`, `leo`, `burnpost`, `bbho`, `cpt`, `ctp`, `actifit`, `alive`, `cent`, `waiv`, `vyb`, `archon`, `neoxian`, `oneup`, etc.).
   - Display relevant tags and post counts based on the active view.
3. **Custom Content Quality Ranking Algorithm for Hot & Trending**:
   - **Trending**: Strictly require posts to have at least **10 comments**. If the initial batch contains fewer than 20 qualifying posts, automatically fetch subsequent pages from the blockchain until at least 20 posts are collected.
   - **Engagement Boost**: Posts with higher comment counts gain a substantial score boost.
   - **Penalties ("Fica mais embaixo")**:
     - Titles containing "daily" / daily logs / reports.
     - Titles containing numbers / series counters (e.g., `#123`, `day 45`, `vol 2`).
     - Titles containing `#hashtags`.
     - Very short titles (< 20 characters or < 4 words).
   - **New (`created`)**: Pure chronological order preserved without re-ranking.

---

## Proposed Changes

### Step 1: Discover Navigation & Tag Reset (`src/context/NavigationContext.tsx`)
- Update `handleNavChange`:
  - When `tab === 'discover'`, reset `setTag('')` and navigate to `/discover`.
  - When `tab === 'feed'`, reset `setTag('')` and navigate to `/feed`.
- When URL pathname matches `/discover` without a `?tag=` search param, ensure `tag` state is cleared to `''`.

### Step 2: Quality Ranking Engine (`src/utils/postRanking.ts`)
- Create a dedicated ranking utility:
  - `calculateQualityScore(post: HivePost): number`
  - Penalties for:
    - Daily reports (`/\bdaily\b/i`, `actifit`, etc.)
    - Numbers and series in title (`/\b\d+\b/`, `/#\d+/`, `/day\s*\d+/i`)
    - Hashtags in title (`/#\w+/`)
    - Short titles (`length < 20` or word count `< 4`)
  - Boosts for:
    - High comment discussion count (`post.children * 15`)
    - Net upvotes and engagement
  - `SPAM_NOISE_TAGS` set containing low-effort and token spam tags: `pob`, `leo`, `inleo`, `leofinance`, `burnpost`, `bbho`, `cpt`, `ctp`, `actifit`, `alive`, `cent`, `waiv`, `vyb`, `archon`, `neoxian`, `oneup`, `hive-engine`, `creativecoin`, `palnet`, etc.

### Step 3: Contextual Trending Topics (`src/components/TrendingTopicsCard.tsx`)
- Refactor `TrendingTopicsCard` to:
  - Aggregate and rank tags exclusively from `feedPosts`.
  - Exclude tags in `SPAM_NOISE_TAGS`.
  - Show post counts for each tag based on current posts.
  - Remove redundant blockchain global tag calls.
  - Allow 1-click filtering and resetting.

### Step 4: Discover Feed Auto-fetch & Ranking (`src/pages/DiscoverPage.tsx`)
- In `fetchFeed`:
  - If `sort === 'trending'`:
    - Filter for `post.children >= 10`.
    - If qualifying count is less than 20, loop/auto-fetch next pagination batches from Hive RPC until at least 20 qualifying posts are collected (or maximum 3 loop attempts to avoid runaway requests).
    - Sort qualifying posts using `calculateQualityScore`.
  - If `sort === 'hot'`:
    - Apply `calculateQualityScore` so high-discussion, quality long-form posts rise to the top while daily repetitive posts with numbers/hashtags sink down.
  - If `sort === 'created'`:
    - Preserve strict chronological order untouched.

---

## Verification Plan
1. **Compilation & Linting**:
   - Run `lint_applet` and `compile_applet` to confirm zero TypeScript and bundling errors.
2. **Tag Reset Verification**:
   - Open a community in Explore Communities (e.g. `/c/hive-163772`), verify feed and sidebar load.
   - Click **Discover** in Navbar: verify URL becomes `/discover`, `currentTag` is empty, and "All Topics" is active.
3. **Trending Topics Verification**:
   - Inspect the Trending Topics sidebar card in Discover: verify tags are extracted from the currently loaded posts and no spam tags (`pob`, `leo`, `burnpost`, `actifit`, `bbho`) appear.
4. **Feed Algorithm Verification**:
   - In **Trending**: verify all displayed posts have 10+ comments and at least 20 posts are presented.
   - In **Hot**: verify quality discussions rank higher, while posts with "daily", numbers, short titles, and hashtags are demoted.
   - In **New**: verify posts remain in strict reverse-chronological order.
