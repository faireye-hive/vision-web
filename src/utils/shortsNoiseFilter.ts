/**
 * Shorts Tag & Noise Detection Utility
 *
 * Provides intelligent classification and filtering of hashtags in Shorts:
 * - Detects spam/bot patterns (numeric sequences, excessive repetition, wordle/game hashes, giveaway strings)
 * - Identifies noise vs genuine community/content tags
 * - Allows users to toggle "Hide spam/noise tags"
 * - Provides baseline curated tags and topic groupings for smooth mobile selection
 */

// Baseline popular and high-quality topics for Hive Shorts / Snaps
export const POPULAR_SHORTS_BASELINE_TAGS: { tag: string; count: number; category: string }[] = [
  { tag: 'hive', count: 184, category: 'crypto' },
  { tag: 'shorts', count: 142, category: 'popular' },
  { tag: 'photography', count: 118, category: 'art' },
  { tag: 'art', count: 86, category: 'art' },
  { tag: 'crypto', count: 79, category: 'crypto' },
  { tag: 'nature', count: 72, category: 'life' },
  { tag: 'life', count: 68, category: 'life' },
  { tag: 'travel', count: 54, category: 'life' },
  { tag: 'food', count: 47, category: 'life' },
  { tag: 'music', count: 42, category: 'art' },
  { tag: 'leofinance', count: 39, category: 'crypto' },
  { tag: 'technology', count: 35, category: 'tech' },
  { tag: 'gaming', count: 33, category: 'tech' },
  { tag: 'vlog', count: 29, category: 'popular' },
  { tag: 'daily', count: 28, category: 'life' },
  { tag: 'streetphotography', count: 26, category: 'art' },
  { tag: 'monochrome', count: 24, category: 'art' },
  { tag: 'catsonhive', count: 22, category: 'life' },
  { tag: 'pets', count: 21, category: 'life' },
  { tag: 'web3', count: 20, category: 'crypto' },
  { tag: 'brasil', count: 18, category: 'popular' },
  { tag: 'spanish', count: 17, category: 'popular' }
];

// Storage key for user pinned / favorite tags in Shorts
export const SHORTS_FAVORITE_TAGS_KEY = 'hive_shorts_favorite_tags';

export function getFavoriteTags(): string[] {
  try {
    const raw = localStorage.getItem(SHORTS_FAVORITE_TAGS_KEY);
    return raw ? JSON.parse(raw) : ['photography', 'art', 'crypto'];
  } catch {
    return ['photography', 'art', 'crypto'];
  }
}

export function saveFavoriteTags(tags: string[]): void {
  try {
    localStorage.setItem(SHORTS_FAVORITE_TAGS_KEY, JSON.stringify(tags));
  } catch {}
}

// Curated topic category tabs for mobile tag filtering
export const SHORTS_TOPIC_CATEGORIES = [
  { id: 'all', label: 'All Clean Tags', icon: 'Hash' },
  { id: 'favorites', label: 'Pinned', icon: 'Star' },
  { id: 'popular', label: 'Popular', icon: 'Flame' },
  { id: 'art', label: 'Photos & Art', icon: 'Camera' },
  { id: 'life', label: 'Life & Nature', icon: 'Heart' },
  { id: 'crypto', label: 'Crypto & Web3', icon: 'Coins' },
  { id: 'tech', label: 'Tech & Gaming', icon: 'Gamepad2' },
  { id: 'noise', label: 'Noise / Blocked', icon: 'ShieldAlert' }
] as const;

export type ShortsTopicCategory = typeof SHORTS_TOPIC_CATEGORIES[number]['id'];

// Known spam and bot tags frequently abused in microblogs / auto-posting scripts
export const DEFAULT_SPAM_NOISE_TAGS = new Set([
  'airdrop',
  'airdrops',
  'giveaway',
  'giveaways',
  'bounty',
  'bounties',
  'scrobblelife',
  'wordle',
  'hivegrove',
  'splinterlands',
  'mydempire',
  'freecrypto',
  'claimnow',
  'claimfree',
  'faucet',
  'faucets',
  'faucetpay',
  'pump',
  'pumppump',
  'signals',
  'freemoney',
  'earncrypto',
  'earnfree',
  't.me',
  'telegram',
  'whatsapp',
  'follow4follow',
  'f4f',
  'sub4sub',
  's4s',
  'like4like',
  'l4l',
  'autospam',
  'autobot',
  'botpost',
  'risingstar',
  'dcrops',
  'cryptobrewmaster',
  'golem',
  'hashkings',
  'woogame',
  'terracore',
  'mutaterra',
  'crypto-shots',
  'steemmonsters',
  'actifit-bot',
  'snaps',
'hivesuite',
'hivesnaps',
'hive-178315',
'dailyreport',
]);

/**
 * Checks whether a tag is considered spam or noise based on heuristic criteria
 */
export function isSpamOrNoiseTag(
  tag: string,
  blockedWords: string[] = []
): { isSpam: boolean; reason?: string } {
  const clean = tag.toLowerCase().trim().replace(/^#/, '');

  if (!clean || clean.length < 2) {
    return { isSpam: true, reason: 'Too short' };
  }

  // Pure digits or random hex strings (e.g. 129381928, 0x12a3b)
  if (/^\d+$/.test(clean) || /^0x[0-9a-fA-F]+$/.test(clean)) {
    return { isSpam: true, reason: 'Numeric or code hash' };
  }

  // Obvious repetitive garbage (e.g. aaaaaaa, asdfasdf)
  if (/(.)\1{4,}/.test(clean)) {
    return { isSpam: true, reason: 'Repetitive characters' };
  }

  // Known global spam patterns
  if (DEFAULT_SPAM_NOISE_TAGS.has(clean)) {
    return { isSpam: true, reason: 'Known bot/spam tag' };
  }

  // User's active blocked words/tags
  const formattedWithHash = `#${clean}`;
  const isUserBlocked = blockedWords.some((w) => {
    const cw = w.toLowerCase().trim();
    return cw === clean || cw === formattedWithHash;
  });

  if (isUserBlocked) {
    return { isSpam: true, reason: 'Blocked by your noise filter' };
  }

  return { isSpam: false };
}

/**
 * Categorizes a tag into one of the topic categories
 */
export function categorizeTag(tag: string): string {
  const clean = tag.toLowerCase().replace(/^#/, '');
  const baseline = POPULAR_SHORTS_BASELINE_TAGS.find((b) => b.tag === clean);
  if (baseline) return baseline.category;

  if (['photography', 'art', 'photo', 'streetphotography', 'monochrome', 'design', 'drawing', 'illustration', 'music', 'sound'].some((k) => clean.includes(k))) {
    return 'art';
  }
  if (['life', 'nature', 'travel', 'food', 'daily', 'blog', 'catsonhive', 'pets', 'family', 'fitness', 'health', 'coffee'].some((k) => clean.includes(k))) {
    return 'life';
  }
  if (['crypto', 'hive', 'bitcoin', 'btc', 'eth', 'leofinance', 'web3', 'finance', 'money', 'token', 'blockchain', 'defi', 'nft'].some((k) => clean.includes(k))) {
    return 'crypto';
  }
  if (['tech', 'technology', 'gaming', 'game', 'dev', 'code', 'ai', 'pc', 'software', 'hardware'].some((k) => clean.includes(k))) {
    return 'tech';
  }
  return 'popular';
}

/**
 * Merges extracted snap hashtags with baseline curated tags to guarantee
 * rich choices even before or during network loads.
 */
export function mergeWithBaselineTags(
  extractedTags: { tag: string; count: number }[]
): { tag: string; count: number }[] {
  const countMap = new Map<string, number>();

  // Add baseline counts first as defaults
  for (const item of POPULAR_SHORTS_BASELINE_TAGS) {
    countMap.set(item.tag.toLowerCase(), item.count);
  }

  // Overlay live extracted tags (taking real live count or adding to baseline)
  for (const item of extractedTags) {
    const clean = item.tag.toLowerCase().replace(/^#/, '');
    if (!clean) continue;
    const existing = countMap.get(clean) || 0;
    countMap.set(clean, Math.max(existing, item.count));
  }

  return Array.from(countMap.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Filters and sorts hashtags, optionally separating or removing spam tags
 */
export function processShortsTags(
  tags: { tag: string; count: number }[],
  options: {
    hideSpam?: boolean;
    searchQuery?: string;
    blockedWords?: string[];
    category?: ShortsTopicCategory;
    favoriteTags?: string[];
  } = {}
): {
  cleanTags: { tag: string; count: number; isSpam: boolean; category: string; isFavorite: boolean }[];
  spamTagsCount: number;
} {
  const {
    hideSpam = true,
    searchQuery = '',
    blockedWords = [],
    category = 'all',
    favoriteTags = []
  } = options;
  const query = searchQuery.trim().toLowerCase().replace(/^#/, '');
  const favSet = new Set(favoriteTags.map((t) => t.toLowerCase().replace(/^#/, '')));

  // Merge with baseline tags if list is sparse
  const mergedTags = tags.length < 5 ? mergeWithBaselineTags(tags) : tags;

  let spamTagsCount = 0;
  const processed: { tag: string; count: number; isSpam: boolean; category: string; isFavorite: boolean }[] = [];

  for (const item of mergedTags) {
    const cleanTag = item.tag.toLowerCase().replace(/^#/, '');
    const { isSpam } = isSpamOrNoiseTag(cleanTag, blockedWords);
    const tagCat = categorizeTag(cleanTag);
    const isFavorite = favSet.has(cleanTag);

    if (isSpam) {
      spamTagsCount++;
      if (hideSpam && category !== 'noise') {
        continue;
      }
    }

    if (category === 'noise') {
      if (!isSpam) continue;
    } else if (category === 'favorites') {
      if (!isFavorite) continue;
    } else if (category !== 'all' && tagCat !== category) {
      continue;
    }

    if (query && !cleanTag.includes(query)) {
      continue;
    }

    processed.push({
      tag: cleanTag,
      count: item.count,
      isSpam,
      category: tagCat,
      isFavorite
    });
  }

  // Sort: favorites first if category is 'all' and no active query, otherwise by count descending
  processed.sort((a, b) => {
    if (category === 'all' && !query && a.isFavorite !== b.isFavorite) {
      return a.isFavorite ? -1 : 1;
    }
    return b.count - a.count;
  });

  return { cleanTags: processed, spamTagsCount };
}

