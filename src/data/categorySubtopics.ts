/**
 * CATEGORY SUBTOPICS REGISTRY
 *
 * This configuration file powers the Subcategory Navigation Bar in the Discover tab.
 * When a user selects a topic/tag (e.g., "art", "photography", "gaming"), the app
 * displays a dedicated sublist of categories right below the feed controls header.
 *
 * HOW TO CUSTOMIZE:
 * 1. To ADD A NEW SUBTOPIC to an existing category:
 *    Add an entry to the `subtopics` array of that category.
 *    Example: { tag: 'watercolor', label: 'Watercolor' }
 *
 * 2. To ADD A WHOLE NEW CATEGORY:
 *    Add a new object to the `RAW_CATEGORY_DEFINITIONS` array below with `tag`, `label`,
 *    `icon`, and your list of `subtopics`.
 *
 * NOTE: The exported CATEGORY_DEFINITIONS will automatically sort categories
 * and subtopics alphabetically (A-Z) by their `label`.
 */

export interface Subtopic {
  tag: string;
  label: string;
  description?: string;
}

export interface CategoryDefinition {
  tag: string; // The primary Hive tag (e.g. 'art', 'photography', 'crypto')
  label: string; // Display label (e.g. 'Art & Design')
  icon: string; // Emoji or visual icon for quick recognition
  description?: string;
  subtopics: Subtopic[];
}

const RAW_CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    tag: 'art',
    label: 'Art & Design',
    icon: '🎨',
    description: 'Visual arts, drawings, paintings, digital creations, and designs',
    subtopics: [
      { tag: 'drawing', label: 'Drawing' },
      { tag: 'painting', label: 'Painting' },
      { tag: 'digitalart', label: 'Digital Art' },
      { tag: 'illustration', label: 'Illustration' },
      { tag: 'sketch', label: 'Sketchbook' },
      { tag: 'pixelart', label: 'Pixel Art' },
      { tag: 'sculpture', label: 'Sculpture & 3D' },
      { tag: 'conceptart', label: 'Concept Art' },
      { tag: 'portrait', label: 'Portrait' },
      { tag: 'design', label: 'Graphic Design' },
      { tag: 'nft', label: 'NFTs & CryptoArt' },
      { tag: 'surrealism', label: 'Surrealism' }
    ]
  },
  {
    tag: 'photography',
    label: 'Photography',
    icon: '📷',
    description: 'Capturing moments, landscapes, portraits, and street life',
    subtopics: [
      { tag: 'photofeed', label: 'PhotoFeed' },
      { tag: 'monochrome', label: 'Black & White' },
      { tag: 'landscape', label: 'Landscape' },
      { tag: 'streetphotography', label: 'Street' },
      { tag: 'portrait', label: 'Portrait' },
      { tag: 'macro', label: 'Macro' },
      { tag: 'naturephotography', label: 'Nature' },
      { tag: 'nightphotography', label: 'Night & Astrophotography' },
      { tag: 'architecture', label: 'Architecture' }
    ]
  },
  {
    tag: 'gaming',
    label: 'Gaming',
    icon: '🎮',
    description: 'Video games, blockchain gaming, walkthroughs, and esports',
    subtopics: [
      { tag: 'splinterlands', label: 'Splinterlands' },
      { tag: 'hivegc', label: 'Hive Gaming' },
      { tag: 'play2earn', label: 'Play-to-Earn' },
      { tag: 'esports', label: 'Esports' },
      { tag: 'retrogaming', label: 'Retro Gaming' },
      { tag: 'rpg', label: 'RPGs' },
      { tag: 'minecraft', label: 'Minecraft' },
      { tag: 'web3gaming', label: 'Web3 Gaming' },
      { tag: 'game-reviews', label: 'Reviews' }
    ]
  },
  {
    tag: 'crypto',
    label: 'Crypto & Web3',
    icon: '🪙',
    description: 'Cryptocurrency, blockchain technology, decentralization, and markets',
    subtopics: [
      { tag: 'bitcoin', label: 'Bitcoin' },
      { tag: 'ethereum', label: 'Ethereum' },
      { tag: 'leofinance', label: 'LeoFinance' },
      { tag: 'defi', label: 'DeFi' },
      { tag: 'trading', label: 'Trading & TA' },
      { tag: 'hive', label: 'Hive & HBD' },
      { tag: 'layer2', label: 'Layer 2' },
      { tag: 'airdrop', label: 'Airdrops' },
      { tag: 'web3', label: 'Web3 Tech' }
    ]
  },
  {
    tag: 'finance',
    label: 'Finance & Economy',
    icon: '📈',
    description: 'Financial literacy, macroeconomics, investing, and wealth building',
    subtopics: [
      { tag: 'economy', label: 'Economy' },
      { tag: 'investing', label: 'Investing' },
      { tag: 'stocks', label: 'Stock Markets' },
      { tag: 'personalfinance', label: 'Personal Finance' },
      { tag: 'business', label: 'Business & Startups' },
      { tag: 'realestate', label: 'Real Estate' },
      { tag: 'gold', label: 'Precious Metals' }
    ]
  },
  {
    tag: 'music',
    label: 'Music & Movies',
    icon: '🎵',
    description: 'Original songs, live performances, beatmaking, and musical reviews',
    subtopics: [
      { tag: 'electronic', label: 'Electronic & EDM' },
      { tag: 'rock', label: 'Rock & Metal' },
      { tag: 'hiphop', label: 'Hip-Hop & Rap' },
      { tag: 'acoustic', label: 'Acoustic & Guitar' },
      { tag: 'singing', label: 'Singing & Vocals' },
      { tag: 'instrumental', label: 'Instrumental' },
      { tag: 'beats', label: 'Beats & Production' },
      { tag: 'songwriting', label: 'Songwriting' }
    ]
  },
  {
    tag: 'food',
    label: 'Food & Culinary',
    icon: '🍳',
    description: 'Recipes, cooking experiments, street food, and baking delights',
    subtopics: [
      { tag: 'recipes', label: 'Recipes' },
      { tag: 'cooking', label: 'Cooking' },
      { tag: 'baking', label: 'Baking' },
      { tag: 'vegan', label: 'Vegan & Plant-Based' },
      { tag: 'dessert', label: 'Desserts & Sweets' },
      { tag: 'streetfood', label: 'Street Food' },
      { tag: 'coffee', label: 'Coffee & Drinks' }
    ]
  },
  {
    tag: 'technology',
    label: 'Tech',
    icon: '💻',
    description: 'Software development, AI, open source, and gadget explorations',
    subtopics: [
      { tag: 'ai', label: 'AI & Machine Learning' },
      { tag: 'coding', label: 'Coding' },
      { tag: 'linux', label: 'Linux & FOSS' },
      { tag: 'python', label: 'Python' },
      { tag: 'webdevelopment', label: 'Web Dev' },
      { tag: 'hardware', label: 'Hardware & Gadgets' },
      { tag: 'cybersecurity', label: 'Cybersecurity' },
      { tag: 'devtools', label: 'Developer Tools' },
      { tag: 'robotics', label: 'Robotics' },
      { tag: 'robot', label: 'Robot' },
      { tag: 'science', label: 'Science' },
      { tag: 'innovation', label: 'Innovation' },
      { tag: 'humanoids', label: 'Humanoids' },
      { tag: 'animatronics', label: 'animatronics' },
    ]
  },
  {
    tag: 'travel',
    label: 'Travel & Places',
    icon: '✈️',
    description: 'Travel stories, country guides, hidden spots, and wanderlust',
    subtopics: [
      { tag: 'traveldigest', label: 'Travel Digest' },
      { tag: 'backpacking', label: 'Backpacking' },
      { tag: 'roadtrip', label: 'Road Trips' },
      { tag: 'citywalk', label: 'Cities & Urban' },
      { tag: 'beach', label: 'Beaches & Islands' },
      { tag: 'culture', label: 'Cultural Travel' },
      { tag: 'travelphotography', label: 'Travel Photos' }
    ]
  },
  {
    tag: 'writing',
    label: 'Writing & Literature',
    icon: '✍️',
    description: 'Creative stories, poetry, essays, book discussions, and prompts',
    subtopics: [
      { tag: 'poetry', label: 'Poetry' },
      { tag: 'fiction', label: 'Fiction' },
      { tag: 'freewrite', label: 'Daily Freewrite' },
      { tag: 'storytelling', label: 'Short Stories' },
      { tag: 'essays', label: 'Essays & Opinions' },
      { tag: 'books', label: 'Book Reviews' },
      { tag: 'fiction', label: 'Fiction Story' },
      { tag: 'story', label: 'Story' },
      { tag: 'poem', label: 'Poem' },
      { tag: 'poetry', label: 'Poetry' },
      { tag: 'writers', label: 'Writers' },
    ]
  },
  {
    tag: 'nature',
    label: 'Nature & Wildlife',
    icon: '🌿',
    description: 'Flora, fauna, outdoor adventures, gardening, and ecology',
    subtopics: [
      { tag: 'wildlife', label: 'Wildlife' },
      { tag: 'birds', label: 'Birdwatching' },
      { tag: 'gardening', label: 'Gardening & Plants' },
      { tag: 'forest', label: 'Forests & Woods' },
      { tag: 'ocean', label: 'Oceans & Marine' },
      { tag: 'environment', label: 'Ecology & Climate' }
    ]
  },
  {
    tag: 'sports',
    label: 'Sports & Fitness',
    icon: '🏃',
    description: 'Physical training, outdoor fitness, athletics, and competitions',
    subtopics: [
      { tag: 'fitness', label: 'Fitness & Gym' },
      { tag: 'actifit', label: 'Actifit Daily' },
      { tag: 'running', label: 'Running & Jogging' },
      { tag: 'cycling', label: 'Cycling' },
      { tag: 'football', label: 'Football / Soccer' },
      { tag: 'martialarts', label: 'Combat & Martial Arts' }
    ]
  },
  {
    tag: 'lifestyle',
    label: 'Lifestyle & Wellness',
    icon: '🧘',
    description: 'Mindfulness, personal growth, habits, home, and well-being',
    subtopics: [
      { tag: 'mindfulness', label: 'Mindfulness' },
      { tag: 'wellness', label: 'Health & Wellness' },
      { tag: 'diy', label: 'DIY & Crafts' },
      { tag: 'minimalism', label: 'Minimalism' },
      { tag: 'productivity', label: 'Productivity' },
      { tag: 'parenting', label: 'Family & Parenting' }
    ]
  },
  {
    tag: 'science',
    label: 'Science & Cosmos',
    icon: '🔬',
    description: 'Scientific research, cosmic discoveries, biology, and physics',
    subtopics: [
      { tag: 'astronomy', label: 'Astronomy & Space' },
      { tag: 'physics', label: 'Physics' },
      { tag: 'biology', label: 'Biology' },
      { tag: 'space', label: 'Cosmology' },
      { tag: 'earthscience', label: 'Earth & Climate' }
    ]
  },
  {
    tag: 'hive',
    label: 'Hive Ecosystem',
    icon: '🐝',
    description: 'Community initiatives, core updates, witnesses, proposals, and apps',
    subtopics: [
      { tag: 'hive-dev', label: 'Hive Dev' },
      { tag: 'proposal', label: 'DHF Proposals' },
      { tag: 'witness', label: 'Witness Updates' },
      { tag: 'hive-engine', label: 'Hive Engine' },
      { tag: 'peakd', label: 'PeakD' },
      { tag: 'inleo', label: 'InLeo' },
      { tag: 'ecency', label: 'Ecency' }
    ]
  },
  {
    tag: 'diy',
    label: 'Diy & Tutorials',
    icon: '🔧',
    description: 'Diy & Tutorials',
    subtopics: [
      { tag: 'crafts', label: 'Crafts' },
      { tag: 'tutorials', label: 'Tutorials' },
    ]
  },
  {
    tag: 'politics',
    label: 'Liberty & Freedom',
    icon: '⚖️',
    description: 'Liberty & Freedom',
    subtopics: [
      { tag: 'Liberty', label: 'Liberty' },
      { tag: 'Freedom', label: 'Freedom' },
    ]
  },
];

/**
 * AUTOMATIC SORTING (A-Z)
 * Sorts both categories and subtopics alphabetically by their display label.
 */
export const CATEGORY_DEFINITIONS: CategoryDefinition[] = RAW_CATEGORY_DEFINITIONS
  .map((category) => ({
    ...category,
    subtopics: [...category.subtopics].sort((a, b) =>
      a.label.localeCompare(b.label, undefined, { sensitivity: 'base' })
    ),
  }))
  .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

/**
 * Finds a category definition that matches the given tag,
 * either as the primary tag or as one of its subtopics.
 */
export function findCategoryByTag(tag: string | null | undefined): CategoryDefinition | undefined {
  if (!tag) return undefined;
  const clean = tag.toLowerCase().trim().replace(/^#/, '');
  if (!clean) return undefined;

  // 1. Direct match on category primary tag
  const directMatch = CATEGORY_DEFINITIONS.find(
    (cat) => cat.tag.toLowerCase() === clean
  );
  if (directMatch) return directMatch;

  // 2. Match as a subtopic of a category
  return CATEGORY_DEFINITIONS.find((cat) =>
    cat.subtopics.some((sub) => sub.tag.toLowerCase() === clean)
  );
}

/**
 * Returns all registered primary category tags
 */
export function getAllPrimaryCategoryTags(): string[] {
  return CATEGORY_DEFINITIONS.map((c) => c.tag);
}