# Recommend Algorithm & Personalized Feed for Discover

A personalized content recommendation engine in the Discover feed that analyzes the user's recent upvoted posts via Hive account history, fetches similar high-quality posts using the HiveSense API with a rate-limited background queue, and delivers a fast, cached, daily-refreshed stream of 200+ curated stories.

## User Review & Critical Decisions

> [!IMPORTANT]
> The following decisions were confirmed through Phase 1 requirements clarification:
> - **Authentication Requirement**: Logged-out visitors selecting the "Recommend" tab will see a focused login prompt explaining that recommendations are tailored to their personal on-chain voting history.
> - **Client-Side Queue & IndexedDB Storage**: The recommendation engine runs entirely client-side using a polite, rate-limited queue (1 request every 1.5 seconds) to query the HiveSense API without backend dependencies or risk of IP rate-limits, storing up to 200+ recommended posts in IndexedDB.
> - **Refresh Frequency**: Recommendations cache persists locally and automatically refreshes once every 24 hours, with an optional manual "Refresh Recommendations" button for on-demand sync.
> - **Scope Focus**: Scope is strictly dedicated to the Recommend algorithm and Discover feed integration.

---

## 1. Overview & Core Concept

- **What It Does**: Adds a new `"Recommend"` sorting option in the Discover page alongside *Hot*, *Trending*, *New*, *Payout*, and *Muted*. When selected by a logged-in user, the app analyzes their last 1,000 on-chain account history operations, extracts the 30 most recent root posts they upvoted (filtering out comments and downvotes), and queries the HiveSense similarity API (`https://api.hive.blog/hivesense-api/posts/{author}/{permlink}/similar`) to build an on-device collection of 200+ personalized recommendations.
- **Target Audience / Persona**: Active Hive readers who want content tailored to the specific topics, authors, and writing styles they genuinely enjoy and support with their upvotes, rather than just global financial payouts or viral memes.
- **Key Value**: Delivers zero-latency, private, client-side personalized discovery without tracking servers, third-party analytics, or heavy backend infrastructure.

---

## 2. User Experience & Visual Design

### Key User Flows

1. **Selecting Recommend Sort**:
   - The user opens Discover and selects **"Recommend"** (styled with a distinct compass/sparkle icon) from the sort dropdown or sort bar.
2. **Logged-Out Experience**:
   - If no Hive account is active, the feed displays a clean, inviting card explaining that personalized recommendations require analyzing their voting history, featuring a direct **"Log in with Keychain"** button.
3. **First-Time Generation / Sync Progress**:
   - If no recommendations are cached or the 24-hour window has expired, a subtle, non-intrusive banner appears above the feed showing polite background sync progress:
     `"Analyzing your upvoted posts and discovering similar stories... (12/30 checked)"`.
   - As batches of similar posts arrive from HiveSense, they immediately populate the feed so the user never waits for all 30 calls to finish before reading.
4. **Infinite Feed & Pagination**:
   - Posts are presented in pages of 20 using standard feed cards (`PostCard` / `GalleryPostCard`). As the user reaches the bottom, the next 20 posts from the 200+ local pool load instantly.
5. **Freshness & Manual Sync**:
   - A subtle header displays `"Last updated 3 hours ago"` with a circular refresh icon to trigger an on-demand re-sync if the user has upvoted new content.

### Visual Identity & Theme

- **Sort Option Styling**:
  - Icon: `Sparkles` or `Compass` with a luminous indigo-blue accent (`text-indigo-600 dark:text-indigo-400`).
  - Label: `"Recommend"` with a quiet descriptive subtitle in the dropdown: `"Personalized stories based on your upvoted posts"`.
- **Feed Header & Status**:
  - Clean, unboxed metadata (`Updated today · 142 stories cached`) with zero pill clutter.
  - Progress bar during background synchronization: thin 2px gradient line (`from-blue-500 to-indigo-600`) without blocking the UI.
- **Empty & Fallback States**:
  - If a user has a new account with zero upvoted root posts in the last 1,000 operations, the view offers an empty state:
    `"No recent upvoted posts found. Upvote a few articles in Hot or Trending to train your recommendations!"`

---

## 3. Key Product Decisions & Trade-Offs

### Decision 1: Client-Side Rate-Limited Queue vs. Backend Proxy
- **Chosen Approach**: Client-side worker queue executing 1 HiveSense similarity request every 1.5 seconds, saving results incrementally into IndexedDB.
- **Why**: Pure client-side architecture preserves user privacy, requires zero external server hosting or API keys, and guarantees polite traffic to `api.hive.blog` without triggering HTTP 429 rate limits.
- **Alternatives Considered**: Server-side cron job was discarded because it requires storing user credentials or tracking accounts on a server, contradicting Nebulosa's decentralized, client-first philosophy.

### Decision 2: IndexedDB Persistent Storage vs. LocalStorage
- **Chosen Approach**: Native browser `IndexedDB` database (`nebulosa_recommendations`) with an object store for posts and a metadata store for timestamps and seed posts.
- **Why**: 200+ full Hive post objects with metadata exceed `localStorage`'s 5MB quota and can cause main-thread JSON serialization hiccups. IndexedDB handles megabytes of structured data asynchronously with zero UI jank.
- **Alternatives Considered**: In-memory cache was discarded because users would have to re-fetch 30 API calls on every page refresh.

### Decision 3: Progressive Display vs. Complete-Wait Loading
- **Chosen Approach**: Posts are deduplicated and appended to the visible feed as each seed post's similar stories are returned, with the feed immediately usable after the first 2-3 calls.
- **Why**: Users should not have to wait 45 seconds (30 calls × 1.5s delay) before seeing any content. Immediate progressive loading provides instantaneous perceived performance.

---

## 4. Technical Architecture & Data Strategy

### System Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────────┐
│                              DISCOVER PAGE                             │
│       ┌────────────────────────────────────────────────────────┐       │
│       │ Sort Dropdown: [ Hot | Trending | New | Recommend* ]   │       │
│       └────────────────────────────────────────────────────────┘       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ activeSort === 'recommend'
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDATION SERVICE ENGINE                      │
│                                                                        │
│  1. Check IndexedDB Cache: Valid (<24h) & Count >= 20?                │
│     ├── YES ──► Return cached items immediately (Paginate by 20)       │
│     └── NO  ──► Start Background Ingestion Pipeline                    │
│                                                                        │
│  2. Ingestion Pipeline:                                                │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │ Hive JSON-RPC: account_history_api.get_account_history     │     │
│     │ Filter: op === 'vote', weight > 0, !permlink.startsWith('re-')│   │
│     │ Result: Up to 30 unique root posts [author, permlink]      │     │
│     └─────────────────────────────┬──────────────────────────────┘     │
│                                   │                                    │
│  3. Rate-Limited Queue:           ▼ (1 request every 1500ms)           │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │ HiveSense API: /hivesense-api/posts/{author}/{permlink}/   │     │
│     │                similar?result_limit=20&full_posts=20       │     │
│     └─────────────────────────────┬──────────────────────────────┘     │
│                                   │                                    │
│  4. Deduplication & Ranking:      ▼                                    │
│     • Exclude already-voted posts                                      │
│     • Deduplicate by author/permlink                                   │
│     • Interleave diverse sources (max 2 per author in top 20)          │
│                                   │                                    │
│  5. Storage & Delivery:           ▼                                    │
│     ┌────────────────────────────────────────────────────────────┐     │
│     │ IndexedDB: 'nebulosa_recommendations'                      │     │
│     │ Store: posts[] + last_updated + seed_count                 │     │
│     └────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────┘
```

### Data Model & State Strategy

- **IndexedDB Schema (`nebulosa_recommendations_db`, version 1)**:
  - `store_posts`: Array of normalized `HivePost` objects with a composite key `author/permlink`.
  - `store_metadata`:
    - `username`: Current user's account name.
    - `last_sync_timestamp`: Epoch timestamp (ms) of the last successful synchronization.
    - `seed_posts`: Array of `{ author, permlink, weight, timestamp }` extracted from account history.
    - `sync_status`: `'idle' | 'syncing' | 'completed' | 'error'`.
    - `sync_progress`: `{ current: number, total: number }`.

- **Filtering Invariants**:
  - `operation_filter_low: 1` targets `vote_operation` specifically.
  - Votes where `op[1].voter !== username` are ignored.
  - Votes where `op[1].author === username` (self-votes) are excluded to ensure topic diversity.
  - Permlinks starting with `re-` (Hive comment standard) or parent author set are discarded.
  - Downvotes (`weight <= 0` or negative rshares) are discarded.
  - Already voted posts are excluded from recommendations to maintain fresh content discovery.

- **Component & Integration Points**:
  - `src/services/recommendationService.ts`: Core service managing IndexedDB, account history parsing, the rate-limited HiveSense caller, and cache invalidation.
  - `src/components/SortDropdown.tsx`: Add `'recommend'` sort type with localized English text, compass icon, and badge indicator.
  - `src/pages/DiscoverPage.tsx`: Hook recommendation service into the `sort` handler, rendering pagination from IndexedDB and displaying sync progress and login prompt banners.
  - `src/components/Navbar.tsx` & `src/components/LeftSidebar.tsx` & `src/components/MobileBottomNav.tsx`: Ensure full TypeScript type compliance across all navigation sort references.
