# Nebulosa Vision - Developer Documentation

Nebulosa Vision is a social network built on the Hive Blockchain. It is a pure client-side application (no backend) that interacts directly with Hive RPC nodes.

## Project Structure

The project is organized into folders for easy maintenance and scalability:

- **`src/`**: Main source code.
  - **`components/`**: Reusable UI components.
    - `Navbar.tsx`: Top navigation bar, includes Hive Keychain login and search.
    - `LeftSidebar.tsx`: Navigation links and contextual discovery (Followed authors, topics, communities).
    - `RightRail.tsx`: Contextual widgets (Trending, Recommended, Shorts info).
    - `PostCard.tsx`: Individual post cards in the feed.
    - `PostReader.tsx`: Full post view component.
    - `ReadingStyleCard.tsx`: Widget to change font size, font family, and theme colors.
  - **`pages/`**: Main application views.
    - `FeedPage.tsx`: Personal feed (Followed authors).
    - `DiscoverPage.tsx`: Global discovery (Trending, Hot, New).
    - `ShortsPage.tsx`: Microblogging feed (Snaps).
    - `ProfilePage.tsx`: User profile and wallet view.
    - `CommunitiesPage.tsx`: Community explorer.
  - **`services/`**: API and external integrations.
    - `hiveApi.ts`: Main service for interacting with the Hive Blockchain.
    - `keychain.ts`: Integration with Hive Keychain browser extension.
    - `combflowApi.ts`: Auxiliary API for enhanced discovery.
  - **`utils/`**: Helper functions (theming, sanitization, relative time, etc.).
  - **`context/`**: React Context providers for global state (Auth, Navigation, Notifications, Content Filters, Bookmarks).

## Key Technologies

- **React (Vite)**: Modern frontend framework.
- **Tailwind CSS**: Utility-first styling.
- **Lucide React**: Icon library.
- **Hive Keychain**: Browser extension for secure transaction signing.
- **DOMPurify**: Sanitization of HTML content from the blockchain to prevent XSS.

## How to Modify the Layout

The layout is primarily controlled in `src/App.tsx` and the individual components in `src/components/`.

### Responsiveness
The app uses Tailwind's responsive prefixes (`sm:`, `md:`, `lg:`, `xl:`) to handle different screen sizes. The main grid in `App.tsx` defines the 3-column layout:
- Mobile: 1 column (Feed).
- LG Screens: 2 columns (Sidebar + Feed).
- XL Screens: 3 columns (Sidebar + Feed + RightRail).

### Styles
Most styles are in Tailwind classes. For specific pixel-perfect requirements (like the `824px` width for the feed), we use arbitrary values like `lg:w-[824px]`.

## Adding New Features

1.  **New Page**: Create a new file in `src/pages/`, add it to the `NavigationContext` (to manage state) and update the main switch in `App.tsx`.
2.  **New API Call**: Add the function to `src/services/hiveApi.ts`.
3.  **New Widget**: Create a component in `src/components/` and add it to `LeftSidebar.tsx` or `RightRail.tsx`.

## Maintenance Tips

- **Content Filtering**: Users can mute authors or words. This is handled in `ContentFilterContext.tsx` and applied in `FeedPage` and `DiscoverPage`.
- **Feed & Discover Post Cards**: Discover cards use fixed dimensions (`minHeight: 157px` on desktop) for aligned layout with side rails, while Feed cards use responsive automatic sizing (`inFeed={true}`) with `overflow: hidden` to accommodate activity banners ("Reblogged by", "Commented on") and variable-length discussions without escaping divs.
- **Discover Dropdowns**: Sort, Language, Category, and Subcategory dropdowns render floating menus (`z-50`) from a fixed `45px` header bar (`overflow: visible`), keeping Discover aligned with side rail cards without expanding the container.
- **Theming**: Theme logic is in `src/utils/theme.ts`. It supports Light and Dark modes.

## Configuring Categories & Subtopics (`src/data/categorySubtopics.ts`)

- Categories and their subtopics are defined in `src/data/categorySubtopics.ts`.
- Subtopics and categories are automatically sorted alphabetically (A-Z) by display label.
- To add subtopics to an existing category (e.g. `technology`), locate the category object and add `{ tag: 'my-tag', label: 'My Label' }` to its `subtopics` array.

## Configuring Contextual Noise Tags (`src/data/topicNoiseConfig.ts`)

Nebulosa Vision features context-sensitive noise filtering for the **Trending Topics** widget in Discover:
- What is "noise" in one category (e.g., `splinterlands` or `recipe` in `technology`) may be a primary topic in another (e.g. in `gaming` or `food`).
- **File**: `src/data/topicNoiseConfig.ts`
- **Manual Code Editing**:
  Open `src/data/topicNoiseConfig.ts` and edit `DEFAULT_CATEGORY_NOISE_MAP`:
  ```ts
  export const DEFAULT_CATEGORY_NOISE_MAP: Record<string, string[]> = {
    technology: [
      'splinterlands',
      'recipe',
      'food',
      'drawing',
      // add any noise tag for tech here...
    ],
    robotics: [
      'splinterlands',
      'recipe',
      // add noise tags specific to the robotics subtag...
    ],
  };
  ```
- **Hierarchical Inheritance**: If viewing subtopic `#robotics`, the system automatically applies noise tags from `#robotics` + parent category `#technology` + global spam noise!
- **Interactive UI Management**: In the Trending Topics card on the right rail, click the **Ruído** button to view and manage muted tags, add new noise tags on the fly, or click the mute icon next to any trending topic. These custom overrides are saved in `localStorage`.
