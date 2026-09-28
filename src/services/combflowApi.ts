/**
 * Combflow & HiveSense Discovery Service
 *
 * Integrates:
 * 1. Combflow API (https://combflow.net/api/languages & https://combflow.net/api/browse)
 *    to retrieve curated, language-specific posts on Hive.
 * 2. HiveSense API (https://api.hive.blog/hivesense-api/posts/by-ids)
 *    to load full post models with rewards, votes, images, and author metadata.
 */

import { HivePost } from './hiveApi';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  count?: number;
  formattedCount?: string;
}

// Fallback top 20 most popular Hive languages from Combflow stats
export const PREDEFINED_TOP_LANGUAGES: LanguageOption[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', count: 14660000, formattedCount: '14.6M' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', count: 2160000, formattedCount: '2.1M' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', count: 641000, formattedCount: '641K' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', count: 616000, formattedCount: '616K' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', count: 391000, formattedCount: '391K' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳', count: 303000, formattedCount: '303K' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', count: 165000, formattedCount: '165K' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', count: 148000, formattedCount: '148K' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', count: 133000, formattedCount: '133K' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', count: 124000, formattedCount: '124K' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', count: 121000, formattedCount: '121K' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', count: 120000, formattedCount: '120K' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦', count: 77000, formattedCount: '77K' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', count: 71000, formattedCount: '71K' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', count: 53000, formattedCount: '53K' },
  { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', count: 39000, formattedCount: '39K' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', count: 30000, formattedCount: '30K' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', count: 23000, formattedCount: '23K' },
  { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', count: 20000, formattedCount: '20K' },
  { code: 'tl', name: 'Tagalog', nativeName: 'Filipino', flag: '🇵🇭', count: 18000, formattedCount: '18K' },
];

const LANGUAGE_DETAILS_MAP: Record<string, { name: string; nativeName: string; flag: string }> = {
  en: { name: 'English', nativeName: 'English', flag: '🇬🇧' },
  es: { name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  ko: { name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  id: { name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  de: { name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  zh: { name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  pl: { name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  ru: { name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  it: { name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  fr: { name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  pt: { name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  tr: { name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  uk: { name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  ja: { name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  th: { name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  cs: { name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿' },
  bn: { name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  ar: { name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  vi: { name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳' },
  tl: { name: 'Tagalog', nativeName: 'Filipino', flag: '🇵🇭' },
};

function formatCount(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}

function stringHashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Memory Cache & Request De-duplication variables
let cachedLanguages: LanguageOption[] | null = null;
let cachedLanguagesPromise: Promise<LanguageOption[]> | null = null;

const CACHE_KEY = 'nebulosa_combflow_languages_cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // Cache válido por 24 horas

/**
 * Carrega idiomas salvos no localStorage, se válidos.
 */
function loadLanguagesFromLocalStorage(): LanguageOption[] | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed.timestamp && Date.now() - parsed.timestamp < CACHE_TTL_MS && Array.isArray(parsed.data)) {
      return parsed.data;
    }
  } catch (err) {
    console.warn('Erro ao ler cache de idiomas do localStorage:', err);
  }
  return null;
}

/**
 * Salva a lista de idiomas no localStorage.
 */
function saveLanguagesToLocalStorage(data: LanguageOption[]) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    localStorage.setItem(
      CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        data,
      })
    );
  } catch (err) {
    console.warn('Erro ao salvar cache de idiomas no localStorage:', err);
  }
}

/**
 * Fetch the top 20 most popular languages from Combflow API (Com Cache e Lock de Concorrência).
 */
export async function getCombflowLanguages(): Promise<LanguageOption[]> {
  // 1. Retorno síncrono em memória
  if (cachedLanguages && cachedLanguages.length > 0) {
    return cachedLanguages;
  }

  // 2. Retorno via localStorage (se o usuário recarregou a página)
  const localCached = loadLanguagesFromLocalStorage();
  if (localCached && localCached.length > 0) {
    cachedLanguages = localCached;
    return localCached;
  }

  // 3. Se uma requisição HTTP já estiver em andamento, reaproveita a mesma Promise
  if (cachedLanguagesPromise) {
    return cachedLanguagesPromise;
  }

  // 4. Cria a Promise para buscar na API apenas uma única vez
  cachedLanguagesPromise = (async () => {
    try {
      const res = await fetch('https://combflow.net/api/languages', {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!res.ok) {
        throw new Error(`Combflow languages HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data && Array.isArray(data.languages)) {
        // Pick top 20
        const top20 = data.languages.slice(0, 20);
        const mapped: LanguageOption[] = top20.map((item: { language: string; count: number }) => {
          const info = LANGUAGE_DETAILS_MAP[item.language] || {
            name: item.language.toUpperCase(),
            nativeName: item.language,
            flag: '🌐',
          };
          return {
            code: item.language,
            name: info.name,
            nativeName: info.nativeName,
            flag: info.flag,
            count: item.count,
            formattedCount: formatCount(item.count),
          };
        });

        cachedLanguages = mapped;
        saveLanguagesToLocalStorage(mapped);
        return mapped;
      }
    } catch (err) {
      console.warn('Failed to fetch Combflow languages live, using fallback list:', err);
    } finally {
      // Limpa a promise ativa após resolver/rejeitar
      cachedLanguagesPromise = null;
    }

    cachedLanguages = PREDEFINED_TOP_LANGUAGES;
    return PREDEFINED_TOP_LANGUAGES;
  })();

  return cachedLanguagesPromise;
}

export interface CombflowBrowsePost {
  id: number;
  author: string;
  permlink: string;
  created: string;
  community_id?: string | null;
  community_name?: string | null;
  primary_language?: string;
  languages?: string[];
  categories?: string[];
  sentiment?: string;
  sentiment_score?: number;
  is_nsfw?: boolean;
}

export interface CombflowBrowseResult {
  posts: CombflowBrowsePost[];
  count: number;
  total: number;
}

/**
 * Fetch posts from Combflow for a given language code.
 * Example URL:
 * https://combflow.net/api/browse?language=de&include_nsfw=false&nsfw_only=false&max_age=7d&limit=20&offset=0
 */
export async function browseCombflowPosts(params: {
  language: string;
  limit?: number;
  offset?: number;
  maxAge?: string;
  category?: string;
}): Promise<CombflowBrowsePost[]> {
  const {
    language,
    limit = 20,
    offset = 0,
    maxAge = '7d',
    category,
  } = params;

  const url = new URL('https://combflow.net/api/browse');
  url.searchParams.set('language', language);
  url.searchParams.set('include_nsfw', 'false');
  url.searchParams.set('nsfw_only', 'false');
  url.searchParams.set('max_age', maxAge);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));

  if (category && category.trim()) {
    url.searchParams.set('category', category.trim().toLowerCase());
  }

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!res.ok) {
    throw new Error(`Combflow browse failed: HTTP ${res.status}`);
  }

  const data: CombflowBrowseResult = await res.json();
  return data.posts || [];
}

/**
 * Fetch full Hive post data using HiveSense API by author + permlink pairs.
 * Endpoint: https://api.hive.blog/hivesense-api/posts/by-ids
 */
export async function fetchHiveSensePostsByIds(
  pairs: { author: string; permlink: string }[],
  observer = ''
): Promise<HivePost[]> {
  if (!pairs || pairs.length === 0) return [];

  const res = await fetch('https://api.hive.blog/hivesense-api/posts/by-ids', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      posts: pairs.map((p) => ({ author: p.author, permlink: p.permlink })),
      truncate: 0,
      observer: observer || '',
    }),
  });

  if (!res.ok) {
    throw new Error(`HiveSense API failed with HTTP ${res.status}`);
  }

  const list: any[] = await res.json();
  if (!Array.isArray(list)) return [];

  // Normalize into HivePost
  return list.map((item) => {
    const numericPostId =
      typeof item.post_id === 'number' && item.post_id > 0
        ? item.post_id
        : stringHashCode(`${item.author}/${item.permlink}`);

    let parsedMetadata = item.json_metadata;
    if (typeof parsedMetadata === 'string') {
      try {
        parsedMetadata = JSON.parse(parsedMetadata);
      } catch {
        // keep string
      }
    }

    // Pending payout value or payout float
    const payoutNum = typeof item.payout === 'number' ? item.payout : parseFloat(item.pending_payout_value || '0') || 0;
    const pendingPayoutStr =
      item.pending_payout_value || (payoutNum > 0 ? `${payoutNum.toFixed(3)} HBD` : '0.000 HBD');

    const normalizedPost: HivePost = {
      post_id: numericPostId,
      author: item.author || '',
      permlink: item.permlink || '',
      category: item.category || '',
      title: item.title || '',
      body: item.body || '',
      json_metadata: parsedMetadata || {},
      created: item.created || new Date().toISOString(),
      updated: item.updated,
      depth: item.depth ?? 0,
      children: item.children ?? 0,
      net_rshares: item.net_rshares ?? 0,
      is_paidout: Boolean(item.is_paidout),
      payout: payoutNum,
      pending_payout_value: pendingPayoutStr,
      author_payout_value: item.author_payout_value,
      curator_payout_value: item.curator_payout_value,
      promoted: item.promoted,
      replies: item.replies,
      author_reputation: typeof item.author_reputation === 'number' ? item.author_reputation : 25,
      stats: item.stats || {
        hide: false,
        gray: false,
        total_votes: Array.isArray(item.active_votes) ? item.active_votes.length : 0,
        flag_weight: 0,
      },
      community: item.community,
      community_title: item.community_title,
      active_votes: item.active_votes || [],
      url: item.url,
      beneficiaries: item.beneficiaries || [],
    };

    return normalizedPost;
  });
}

/**
 * High-level function: Get full language posts pipeline:
 * Combflow Browse -> HiveSense Post Details
 */
export async function getLanguageDiscoveryFeed(params: {
  language: string;
  limit?: number;
  offset?: number;
  observer?: string;
  category?: string;
}): Promise<HivePost[]> {
  const { language, limit = 20, offset = 0, observer = '', category } = params;

  // 1. Fetch Combflow post summaries (author & permlink)
  const combflowItems = await browseCombflowPosts({
    language,
    limit,
    offset,
    maxAge: '7d',
    category,
  });

  if (!combflowItems || combflowItems.length === 0) {
    return [];
  }

  // 2. Fetch full post details via HiveSense API
  const pairs = combflowItems.map((p) => ({
    author: p.author,
    permlink: p.permlink,
  }));

  const fullPosts = await fetchHiveSensePostsByIds(pairs, observer);

  // If HiveSense returns in order, fullPosts are ready; ensure fallback alignment
  if (fullPosts.length > 0) {
    return fullPosts;
  }

  return [];
}