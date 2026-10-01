/**
 * ============================================================================
 * NEBULOSA VISION - TOPIC NOISE CONFIGURATION (CONFIGURAÇÃO DE RUÍDO DE TAGS)
 * ============================================================================
 * 
 * Este arquivo define as tags de "ruído" (tags indesejadas, spam ou fora de contexto)
 * específicas para cada categoria ou subtag no Discover.
 * 
 * COMO FUNCIONA:
 * 1. Cada categoria ou tag tem sua própria lista de ruído.
 *    Exemplo: Em "technology", tags como "splinterlands" ou "recipe" são ruído.
 *    Mas em "gaming", "splinterlands" NÃO é ruído, e em "food", "recipe" NÃO é ruído!
 * 
 * 2. COMO EDITAR MANUALMENTE:
 *    - Para adicionar ou remover ruído de uma categoria, encontre a chave correspondente
 *      em `DEFAULT_CATEGORY_NOISE_MAP` (ex: `technology: [...]`) e adicione a tag (em minúsculas).
 *    - Para criar ruído para uma subtag específica (ex: `robotics`), basta adicionar uma nova
 *      chave com o nome da subtag:
 *      ```
 *      robotics: ['splinterlands', 'recipe', 'drawing', 'makeup'],
 *      ```
 *    - O sistema herda ruído: se você estiver na subtag `robotics`, ele combina o ruído
 *      específico de `robotics` com o ruído da categoria pai `technology` e o ruído global.
 * 
 * 3. NOVO: Você também pode mutar ou desmutar tags diretamente pela interface no card
 *    Trending Topics, e elas serão salvas no navegador (localStorage).
 * ============================================================================
 */

import { findCategoryByTag } from './categorySubtopics';

/**
 * Ruído Global: tags de bot rings, mineração de votos e spam que não agregam
 * valor a nenhuma categoria temática.
 */
export const GLOBAL_SPAM_NOISE: string[] = [
  'pob',
  'leo',
  'burnpost',
  'bbho',
  'bbh',
  'cpt',
  'ctp',
  'actifit',
  'alive',
  'cent',
  'waiv',
  'vyb',
  'archon',
  'neoxian',
  'oneup',
  'creativecoin',
  'proofofbrain',
  'pimp',
  'appreciator',
  'palnet',
  'arcadecolony',
  'qurator',
  'weedcash',
  'lassecash',
  'free-compliments',
  'posh',
  'curation',
  'percentmap',
  'tribes',
  'curangel',
  'ecency',
  'peakd',
  'gems',
  'lolz',
  'polish',
  'waivio',
  'ocdb',
  'r2cornell',
  'dbuzz',
  'pepe',
  'bpc',
  'curie',
  'blog',
  'ocd'
];

/**
 * MAPA DE RUÍDO POR CATEGORIA E SUBTAG
 * Mapeie a tag da categoria ou subtag para um array de tags que NÃO devem
 * aparecer no Trending Topics quando essa categoria/subtag estiver selecionada.
 */
export const DEFAULT_CATEGORY_NOISE_MAP: Record<string, string[]> = {
  // 💻 TECH & DEVELOPERS
  technology: [
    'splinterlands',
    'spt',
    'photography',
    'photofeed',
    'food',
    'recipe',
    'recipes',
    'travel',
    'drawing',
    'painting',
    'contest',
    'giveaway',
    'poem',
    'poetry',
    'music',
    'gaming',
    'sportstalk',
    'makeup',
    'fashion',
    'gardening',
    'needlework'
  ],

  // 🤖 SUBTAG TECH: ROBOTICS
  robotics: [
    'splinterlands',
    'recipe',
    'food',
    'painting',
    'makeup',
    'fashion',
    'poetry',
    'gaming',
    'needlework',
    'crypto-signals'
  ],

  // 🎨 ART & DESIGN
  art: [
    'splinterlands',
    'spt',
    'trading',
    'bitcoin',
    'crypto',
    'stocks',
    'forex',
    'finance',
    'sports',
    'football',
    'recipe',
    'cooking',
    'cybersecurity',
    'spanish',
    'ecency',
    'photography',
    'curangel',
    'diy',
    'tutorial',
    'crichet',
    'ocd',
    'travel',
    'gems',
    'vlog',
    'peakd',
    'lolz',
    'life',
    'story',
    'videogames',
    'hive',
    'polish',
    'waivio',
    'ocdb',
    'photo',
    'community-update',
    'monomad',
    'blackandwhite',
    'diyhub',
    'crafting',
    'discovery-it',
    'hispapro',
    'zingtoken',
    'venezuela',
    'lifestyle',
    'horse',
    'needlework',
    'crochet',
    'amigurumi',
    'contest',
    'writing',
    'contests',
    'sewing',
    'knitting',
    'handicraft',
    'hivediy',
    'crafts',
    'handmade',
    'fotografia',
  ],

  // 📷 PHOTOGRAPHY
  photography: [
    'splinterlands',
    'spt',
    'bitcoin',
    'crypto',
    'trading',
    'programming',
    'python',
    'coding',
    'gaming',
    'minecraft',
    'esports',
    'cybersecurity'
  ],

  // 🎮 GAMING
  gaming: [
    'recipes',
    'food',
    'cooking',
    'gardening',
    'sewing',
    'knitting',
    'needlework',
    'politics',
    'realestate',
    'stockmarket'
  ],

  // 🪙 CRYPTO & WEB3
  crypto: [
    'recipes',
    'food',
    'cooking',
    'watercolor',
    'gardening',
    'sewing',
    'knitting',
    'needlework',
    'makeup',
    'fashion'
  ],

  // 📈 FINANCE & ECONOMY
  finance: [
    'splinterlands',
    'gaming',
    'minecraft',
    'drawing',
    'painting',
    'recipes',
    'food',
    'poem',
    'poetry',
    'makeup'
  ],

  // 🍳 FOOD & CULINARY
  food: [
    'bitcoin',
    'crypto',
    'trading',
    'gaming',
    'splinterlands',
    'programming',
    'coding',
    'cybersecurity',
    'stocks',
    'linux'
  ],

  // 🎵 MUSIC & MOVIES
  music: [
    'crypto',
    'trading',
    'stocks',
    'splinterlands',
    'recipes',
    'food',
    'cybersecurity',
    'programming'
  ],

  // ✈️ TRAVEL & PLACES
  travel: [
    'crypto',
    'bitcoin',
    'trading',
    'programming',
    'coding',
    'splinterlands',
    'cybersecurity',
    'gaming'
  ],

  // 🔬 SCIENCE
  science: [
    'splinterlands',
    'recipes',
    'giveaway',
    'contest',
    'makeup',
    'fashion',
    'crypto-signals'
  ],

  // ✍️ WRITING & LITERATURE
  writing: [
    'crypto-signals',
    'forex',
    'trading',
    'splinterlands',
    'cybersecurity',
    'hardware'
  ],

  // 🏃 FITNESS & HEALTH
  fitness: [
    'crypto',
    'trading',
    'splinterlands',
    'programming',
    'gaming',
    'cybersecurity'
  ],

  // 🛠️ DIY & CRAFTS
  diy: [
    'crypto',
    'trading',
    'bitcoin',
    'splinterlands',
    'cybersecurity',
    'forex'
  ],

  // ⚖️ LIBERTY & POLITICS
  politics: [
    'gaming',
    'splinterlands',
    'recipes',
    'baking',
    'knitting',
    'minecraft'
  ],

  // 🌿 NATURE & ENVIRONMENT
  nature: [
    'crypto',
    'trading',
    'splinterlands',
    'programming',
    'cybersecurity',
    'forex'
  ],

  // 📚 EDUCATION & LEARNING
  education: [
    'splinterlands',
    'crypto-signals',
    'giveaways',
    'airdrop',
    'casino'
  ]
};

// Chaves do localStorage
const CUSTOM_NOISE_STORAGE_KEY = 'nebulosa_custom_topic_noise';
const UNMUTED_NOISE_STORAGE_KEY = 'nebulosa_unmuted_topic_noise';

/**
 * Lê customizações de ruído adicionadas pelo usuário na interface.
 * Formato: { [contextTag]: ['tag1', 'tag2'] }
 */
export function getStoredCustomNoise(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(CUSTOM_NOISE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Lê tags que o usuário escolheu re-ativar (desmutar) que vinham do arquivo padrão.
 */
export function getStoredUnmutedNoise(): Record<string, string[]> {
  try {
    const raw = localStorage.getItem(UNMUTED_NOISE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Salva customizações de ruído do usuário.
 */
function saveStoredCustomNoise(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(CUSTOM_NOISE_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Salva tags desmutadas pelo usuário.
 */
function saveStoredUnmutedNoise(map: Record<string, string[]>): void {
  try {
    localStorage.setItem(UNMUTED_NOISE_STORAGE_KEY, JSON.stringify(map));
  } catch {}
}

/**
 * Normaliza uma tag (minúsculas, sem #, sem espaços)
 */
export function normalizeTag(tag: string): string {
  return tag.toLowerCase().trim().replace(/^#/, '');
}

/**
 * Retorna todas as tags de ruído aplicáveis a um contexto atual (ex: 'technology', 'robotics' ou '').
 * 
 * Regra de resolução:
 * 1. Ruído Global (sempre ativo)
 * 2. Se contextTag foi informada:
 *    - Ruído da categoria pai (se contextTag for uma subtag)
 *    - Ruído específico da contextTag definida no código
 *    - Ruídos customizados adicionados pelo usuário
 *    - Remove quaisquer tags que o usuário tenha explicitamente desmutado
 */
export function getNoiseTagsForContext(contextTag?: string | null): string[] {
  const noiseSet = new Set<string>(GLOBAL_SPAM_NOISE.map(normalizeTag));

  if (!contextTag) {
    // Contexto global (sem tag ativa)
    const customNoise = getStoredCustomNoise();
    const globalCustom = customNoise['_global'] || [];
    globalCustom.forEach((t) => noiseSet.add(normalizeTag(t)));

    const unmutedNoise = getStoredUnmutedNoise();
    const globalUnmuted = unmutedNoise['_global'] || [];
    globalUnmuted.forEach((t) => noiseSet.delete(normalizeTag(t)));

    return Array.from(noiseSet);
  }

  const cleanContext = normalizeTag(contextTag);

  // 1. Ruído da categoria pai (se contextTag pertencer a uma categoria)
  const categoryDef = findCategoryByTag(cleanContext);
  if (categoryDef && categoryDef.tag.toLowerCase() !== cleanContext) {
    const parentNoise = DEFAULT_CATEGORY_NOISE_MAP[categoryDef.tag.toLowerCase()] || [];
    parentNoise.forEach((t) => noiseSet.add(normalizeTag(t)));
  }

  // 2. Ruído definido em código para este contexto
  const directNoise = DEFAULT_CATEGORY_NOISE_MAP[cleanContext] || [];
  directNoise.forEach((t) => noiseSet.add(normalizeTag(t)));

  // 3. Ruído customizado salvo no localStorage
  const customMap = getStoredCustomNoise();
  const contextCustom = customMap[cleanContext] || [];
  contextCustom.forEach((t) => noiseSet.add(normalizeTag(t)));

  if (categoryDef && categoryDef.tag.toLowerCase() !== cleanContext) {
    const parentCustom = customMap[categoryDef.tag.toLowerCase()] || [];
    parentCustom.forEach((t) => noiseSet.add(normalizeTag(t)));
  }

  // 4. Remover tags desmutadas pelo usuário
  const unmutedMap = getStoredUnmutedNoise();
  const contextUnmuted = unmutedMap[cleanContext] || [];
  contextUnmuted.forEach((t) => noiseSet.delete(normalizeTag(t)));

  return Array.from(noiseSet);
}

/**
 * Adiciona uma tag de ruído para o contexto selecionado.
 */
export function addCustomNoiseTag(contextTag: string | null | undefined, noiseTag: string): void {
  const ctx = contextTag ? normalizeTag(contextTag) : '_global';
  const tagToAdd = normalizeTag(noiseTag);
  if (!tagToAdd) return;

  const customMap = getStoredCustomNoise();
  const currentList = customMap[ctx] || [];
  if (!currentList.includes(tagToAdd)) {
    customMap[ctx] = [...currentList, tagToAdd];
    saveStoredCustomNoise(customMap);
  }

  // Remove da lista de desmutados caso estivesse lá
  const unmutedMap = getStoredUnmutedNoise();
  if (unmutedMap[ctx]) {
    unmutedMap[ctx] = unmutedMap[ctx].filter((t) => normalizeTag(t) !== tagToAdd);
    saveStoredUnmutedNoise(unmutedMap);
  }
}

/**
 * Remove uma tag de ruído para o contexto selecionado (permite que ela volte a aparecer).
 */
export function removeNoiseTag(contextTag: string | null | undefined, noiseTag: string): void {
  const ctx = contextTag ? normalizeTag(contextTag) : '_global';
  const tagToRemove = normalizeTag(noiseTag);
  if (!tagToRemove) return;

  // Se estava nos customizados, remove
  const customMap = getStoredCustomNoise();
  if (customMap[ctx]) {
    customMap[ctx] = customMap[ctx].filter((t) => normalizeTag(t) !== tagToRemove);
    saveStoredCustomNoise(customMap);
  }

  // Registra como desmutado para anular definição do código
  const unmutedMap = getStoredUnmutedNoise();
  const currentUnmuted = unmutedMap[ctx] || [];
  if (!currentUnmuted.includes(tagToRemove)) {
    unmutedMap[ctx] = [...currentUnmuted, tagToRemove];
    saveStoredUnmutedNoise(unmutedMap);
  }
}

/**
 * Restaura as tags de ruído padrão de um contexto, apagando customizações locais.
 */
export function resetContextNoise(contextTag: string | null | undefined): void {
  const ctx = contextTag ? normalizeTag(contextTag) : '_global';
  const customMap = getStoredCustomNoise();
  delete customMap[ctx];
  saveStoredCustomNoise(customMap);

  const unmutedMap = getStoredUnmutedNoise();
  delete unmutedMap[ctx];
  saveStoredUnmutedNoise(unmutedMap);
}
