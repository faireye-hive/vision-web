import { CATEGORY_DEFINITIONS, CategoryDefinition } from '../data/categorySubtopics';
import { HiveCommunity } from '../services/hiveApi';

export interface LanguageInfo {
  code: string;
  name: string;
  flag: string;
}

export interface ClassifiedCommunity {
  community: HiveCommunity;
  categoryTag: string;
  categoryLabel: string;
  categoryIcon: string;
  language: LanguageInfo;
}

const GENERAL: Pick<ClassifiedCommunity, 'categoryTag' | 'categoryLabel' | 'categoryIcon'> = {
  categoryTag: 'general',
  categoryLabel: 'General',
  categoryIcon: '✨'
};

const LANGUAGES: Record<string, LanguageInfo> = {
  en: { code: 'en', name: 'English', flag: '🇬🇧' },
  es: { code: 'es', name: 'Español', flag: '🇪🇸' },
  pt: { code: 'pt', name: 'Português', flag: '🇵🇹' },
  de: { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  fr: { code: 'fr', name: 'Français', flag: '🇫🇷' },
  it: { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  ko: { code: 'ko', name: '한국어', flag: '🇰🇷' },
  zh: { code: 'zh', name: '中文', flag: '🇨🇳' },
  ja: { code: 'ja', name: '日本語', flag: '🇯🇵' },
  ru: { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  pl: { code: 'pl', name: 'Polski', flag: '🇵🇱' },
  id: { code: 'id', name: 'Bahasa Indonesia', flag: '🇮🇩' },
  tr: { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  uk: { code: 'uk', name: 'Українська', flag: '🇺🇦' },
  th: { code: 'th', name: 'ไทย', flag: '🇹🇭' },
  vi: { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
  ar: { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  hi: { code: 'hi', name: 'हिन्दी', flag: '🇮🇳' },
  nl: { code: 'nl', name: 'Nederlands', flag: '🇳🇱' },
  sv: { code: 'sv', name: 'Svenska', flag: '🇸🇪' },
  und: { code: 'und', name: 'Other', flag: '🌐' }
};

const EXTRA_KEYWORDS: Record<string, string[]> = {
  art: ['drawing', 'painting', 'illustration', 'sketch', 'design', 'pixel', 'arte', 'desenho'],
  photography: ['photo', 'photography', 'fotografia', 'foto', 'photofeed', 'portrait'],
  gaming: ['game', 'gaming', 'splinterlands', 'play2earn', 'esports', 'juego', 'jogo'],
  crypto: ['crypto', 'bitcoin', 'ethereum', 'defi', 'blockchain', 'token', 'web3', 'altcoin'],
  finance: ['finance', 'investing', 'economy', 'trading', 'business', 'mercado', 'Stocks', 'Markets', 'entrepreneur', 'emprendedor'],
  music: ['music', 'song', 'audio', 'musica', 'música', 'beat', 'movie', 'movies'],
  food: ['food', 'recipe', 'cooking', 'receita', 'comida', 'vegan', 'baking'],
  technology: ['technology', 'coding', 'software', 'developer', 'linux', 'programming', 'python', 'STEM', 'science'],
  travel: ['travel', 'viagem', 'viaje', 'tourism', 'backpack', 'worldmap', 'travel', 'travels'],
  writing: ['writing', 'poetry', 'fiction', 'poesia', 'story', 'literatura', 'books', 'book', 'literature'],
  nature: ['nature', 'wildlife', 'garden', 'natureza', 'ecology', 'forest', 'vegan', 'plant'],
  sports: ['sport', 'sports', 'fitness', 'actifit', 'football', 'running', 'esporte'],
  lifestyle: ['lifestyle', 'wellness', 'mindfulness', 'diy', 'parenting'],
  science: ['science', 'astronomy', 'space', 'physics', 'biology', 'ciencia'],
  hive: ['witness', 'peakd', 'ecency', 'proposal', 'dapps'],
  diy: ['diy', 'craft'],
  politics: ['freedom', 'liberty', 'censorship', 'rant', 'complain', 'talk'],
};

const KNOWN_CATEGORIES: Record<string, string> = {
  'hive-125125': 'hive',
  'hive-193816': 'music',
  'hive-163772': 'travel',
  'hive-167922': 'crypto',
  'hive-174578': 'photography',
  'hive-148441': 'crypto',
  'hive-13323': 'gaming',
  'hive-196037': 'crypto',
  'hive-110713': 'music',
  'hive-153850': 'hive',
  'hive-147010': 'photography',
  'hive-126152': 'lifestyle',
  'hive-120586': 'food',
  'hive-187189': 'lifestyle',
  'hive-140635': 'nature',
  'hive-124452': 'lifestyle',
  'hive-106687': 'sports',
  'hive-130560': 'diy',
  'hive-178138': 'lifestyle',
  'hive-127911': 'diy',
  'hive-178265': 'lifestyle',
  'hive-148416': 'sports',
  'hive-185676': 'gaming',
  'hive-131131': 'gaming',
  'hive-108045': 'lifestyle',
  'hive-147177': 'lifestyle',
  'hive-115814': 'sports',
  'hive-158694': 'art',
  'hive-166847': 'music',
  'hive-189157': 'sports',
  'hive-132248': 'photography',
  'hive-189641': 'diy',
  'hive-179291': 'writing',
  'hive-156509': 'art',
  'hive-184784': 'art',
  'hive-196387': 'technology',
  'hive-197333': 'hive',
  'hive-189306': 'hive',
  'hive-106444': 'nature',
  'hive-174680': 'nature',
  'hive-187635': 'nature',
  'hive-106258': 'nature',
  'hive-196708': 'nature',
  'hive-155530': 'fitness',
  'hive-131951': 'wellness',
  'hive-179017': 'photography', 
  'hive-114308': 'diy',
  'hive-106817': 'technology',
  'hive-152524': 'food',
  'hive-151327': 'nature',
};

function includesTerm(haystack: string, term: string): boolean {
  const needle = term.toLowerCase().trim();
  if (needle.length < 4) return false;
  if (needle.length >= 6) return haystack.includes(needle);
  return new RegExp(`(^|[^a-z0-9])${needle}([^a-z0-9]|$)`, 'i').test(haystack);
}

export function describeLanguage(code: string | undefined | null): LanguageInfo {
  const clean = (code || '').toLowerCase().slice(0, 2);
  return LANGUAGES[clean] || { code: clean || 'und', name: (code || 'Other').toUpperCase(), flag: '🌐' };
}

export function listKnownLanguages(): LanguageInfo[] {
  return Object.values(LANGUAGES).filter((lang) => lang.code !== 'und');
}

function detectLanguage(community: HiveCommunity): LanguageInfo {
  const declared = (community.lang || '').toLowerCase().trim();
  if (declared && declared !== 'und') {
    return describeLanguage(declared);
  }

  const text = `${community.title || ''} ${community.about || ''}`;
  if (/[\u4e00-\u9fff]/.test(text)) return LANGUAGES.zh;
  if (/[\uac00-\ud7af]/.test(text)) return LANGUAGES.ko;
  if (/[\u0400-\u04ff]/.test(text)) return LANGUAGES.ru;
  if (/[\u0600-\u06ff]/.test(text)) return LANGUAGES.ar;
  if (/[áàâãéêíóôõúç]/i.test(text)) return LANGUAGES.pt;
  if (/[ñ¿¡]/i.test(text)) return LANGUAGES.es;
  return LANGUAGES.und;
}

function classifyCategory(community: HiveCommunity): Pick<ClassifiedCommunity, 'categoryTag' | 'categoryLabel' | 'categoryIcon'> {
  const known = KNOWN_CATEGORIES[community.name];
  const knownDef = known ? CATEGORY_DEFINITIONS.find((cat) => cat.tag === known) : undefined;
  if (knownDef) {
    return { categoryTag: knownDef.tag, categoryLabel: knownDef.label, categoryIcon: knownDef.icon };
  }

  const haystack = `${community.title || ''} ${community.about || ''}`.toLowerCase();
  let best: { def: CategoryDefinition; score: number } | null = null;

  for (const def of CATEGORY_DEFINITIONS) {
    const terms = [
      def.tag,
      def.label,
      ...def.subtopics.map((sub) => sub.tag),
      ...def.subtopics.map((sub) => sub.label),
      ...(EXTRA_KEYWORDS[def.tag] || [])
    ];
    let score = 0;
    const seen = new Set<string>();
    for (const term of terms) {
      const key = term.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      if (includesTerm(haystack, key)) {
        score += key.length >= 7 ? 2 : 1;
      }
    }
    if (def.tag === 'hive') score *= 0.45;
    if (!best || score > best.score) best = { def, score };
  }

  if (!best || best.score < 2) return GENERAL;
  return {
    categoryTag: best.def.tag,
    categoryLabel: best.def.label,
    categoryIcon: best.def.icon
  };
}

export function classifyCommunity(community: HiveCommunity): ClassifiedCommunity {
  return {
    community,
    ...classifyCategory(community),
    language: detectLanguage(community)
  };
}

export function categoryChoices(): Array<{ tag: string; label: string; icon: string }> {
  return [
    { tag: 'all', label: 'All topics', icon: '✦' },
    ...CATEGORY_DEFINITIONS.map((cat) => ({ tag: cat.tag, label: cat.label, icon: cat.icon })),
    { tag: GENERAL.categoryTag, label: GENERAL.categoryLabel, icon: GENERAL.categoryIcon }
  ];
}
