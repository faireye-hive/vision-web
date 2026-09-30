# Implementation Plan: Profile Page Modular Style & Layout Customization

## Overview
This feature introduces an in-place visual layout and styling customization system exclusively for the **Profile Page** (`/profile/@username`). Each user can customize their own profile's layout structure, section ordering, visibility of individual components, background imagery, color themes, glassmorphism transparency, and typography. The configuration is broadcast to the Hive blockchain via Hive Keychain (`custom_json`) so that any visitor viewing that profile sees the owner's custom design, with local cache fallback for instant rendering.

---

## 1. Architecture & Component Organization

To follow the project constitution regarding clean separation of concerns and modularity, all profile customization logic will reside in a dedicated directory: `src/features/profile/`.

```
src/
├── features/
│   └── profile/
│       ├── types.ts                      # ProfileStyleConfig, SectionId, Preset, LayoutType
│       ├── defaultStyle.ts               # Default configurations & pre-built style presets
│       ├── profileStyleService.ts        # Hive custom_json broadcast, account history reader, & cache
│       ├── ProfileCustomizerDrawer.tsx   # Live in-place editor with tabs, sliders, toggles & reordering
│       └── sections/                     # Modular sections that can be dynamically ordered/hidden
│           ├── ProfileHeaderSection.tsx  # Banner, avatar (rounded/circle/square), name, follow/edit buttons
│           ├── ProfileBioSection.tsx     # About text, location, website, created date
│           ├── ProfileStatsSection.tsx   # Follower counts, reputation, balances, post counter
│           ├── ProfileBadgesSection.tsx  # Subscribed communities, tags & badge pills
│           └── ProfileFeedSection.tsx    # Tabs (Posts, Comments, Replies, Mentions, History) & feed list
├── services/
│   └── keychain.ts                       # Add broadcastCustomJson helper if missing
└── pages/
    └── ProfilePage.tsx                   # Refactored to render sections based on ProfileStyleConfig
```

---

## 2. Key Capabilities & Customization Options

### A. Layout Structure (`layoutType`)
- **Full-Width Hero (Default)**: Classic expansive cover banner with bottom avatar and centered/left-aligned content.
- **Bento Grid**: Modern modular card grid where stats, bio, and badges form complementary dashboard cards beside/above the feed.
- **Split 2-Column**: Sticky left sidebar with avatar, bio, and stats; right column dedicated to feed and tabs.
- **Centered Compact**: Minimalist card with centered avatar, compact metrics, and focused content feed.

### B. Section Reordering & Visibility (`sections`)
- Configurable modular sections:
  1. `header` (Banner & Identity)
  2. `stats` (Followers, Reputation, Balances)
  3. `bio` (About text, links, metadata)
  4. `badges` (Subscribed communities & frequent tags)
  5. `feed` (Posts, Comments, Replies, Mentions, Activity)
- Each section can be toggled **Visible / Hidden** (header & feed required, others optional).
- Each section can be reordered up/down to create personalized content flows.

### C. Visual Styling & Ambience (Scoped strictly to Profile)
- **Background**:
  - Solid color, gradient, or Custom Background Image URL.
  - Background overlay tint (opacity control) & optional background blur.
- **Card Aesthetics**:
  - Surface opacity (solid, semi-transparent frosted glass, or borderless outline).
  - Border radius (sharp `rounded-lg`, standard `rounded-2xl`, ultra-curved `rounded-3xl`).
  - Card shadow & border intensity.
- **Accent & Typography**:
  - Primary accent color (Blue, Purple, Emerald, Rose, Amber, Cyan, or custom hex).
  - Font family override for profile text (System, Serif, Mono, Rounded).
  - Avatar shape: Circle, Rounded Square, or Hexagon/Squircle.
- **Curated Presets**:
  - One-click presets: *Default Clean*, *Cyberpunk Neon*, *Frosted Glass*, *Warm Editorial*, *Minimalist Mono*, *Midnight Velvet*.

---

## 3. Blockchain Storage & Persistence (`custom_json`)

### Hive Keychain Broadcast
- Operation: `custom_json`
- Authority: `Posting` (no Active key or token fees required)
- ID: `nebulosa_profile_style`
- Payload:
  ```json
  {
    "app": "nebulosa/1.0",
    "version": 1,
    "style": {
      "layoutType": "bento",
      "sections": [
        { "id": "header", "visible": true },
        { "id": "bio", "visible": true },
        { "id": "stats", "visible": true },
        { "id": "badges", "visible": true },
        { "id": "feed", "visible": true }
      ],
      "theme": {
        "accentColor": "#6366f1",
        "bgType": "image",
        "bgImageUrl": "https://...",
        "bgOverlayOpacity": 0.4,
        "cardStyle": "glass",
        "borderRadius": "2xl",
        "fontFamily": "system"
      }
    }
  }
  ```

### Retrieval & Hydration Flow
1. **Immediate Cache**: Read `localStorage.getItem(`nebulosa_profile_style:${username}`)` for instant zero-flicker loading.
2. **Blockchain Fetch**: If viewing another user's profile or refreshing, fetch the account's recent `custom_json` operations matching `id === 'nebulosa_profile_style'` via Hive RPC (`condenser_api.get_account_history`), parse the JSON, and update the view and cache.
3. **Safety Fallback**: If no custom style is published or parsing fails, seamlessly fall back to `DEFAULT_PROFILE_STYLE`.

---

## 4. User Experience & In-Place Edit Flow

1. When `currentUser.username === profileUser` (viewing your own profile), a floating or top-bar button appears: **"Customize Profile"** / **"Personalizar Perfil"** with a magic wand icon.
2. Clicking opens an in-place editing drawer/bar that lets the user change presets, tweak colors, reorder sections, and adjust cards in **real-time** on the actual profile page without leaving.
3. Controls include:
   - **Live Preview toggle**: Test changes instantly before saving.
   - **Revert / Reset**: Revert back to default or discard draft changes.
   - **Save to Hive (Keychain)**: Triggers Hive Keychain `requestCustomJson` to publish to the blockchain, saving locally immediately.
   - **Save Local**: Option to save locally in browser if Keychain is not installed or user wants a private draft.

---

## 5. Verification & Testing

- Compile and lint check with `compile_applet` and `lint_applet`.
- Verify that custom profile styles apply **strictly to the Profile page** container (`#profile-custom-container`) and do not bleed into global styles, Feed, Discover, Shorts, or Reader.
- Verify section reordering and visibility toggles accurately position elements.
- Verify graceful fallback when an account has no custom style or is viewed by guests.
