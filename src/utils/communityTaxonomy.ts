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

type CategoryResult = Pick<ClassifiedCommunity, 'categoryTag' | 'categoryLabel' | 'categoryIcon'>;

const GENERAL: CategoryResult = {
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

// Chaves = `tag` de CATEGORY_DEFINITIONS (categorySubtopics.ts).
const EXTRA_KEYWORDS: Record<string, string[]> = {
  animals: ['animal', 'animals', 'pets', 'pet', 'dog', 'dogs', 'cat', 'cats', 'aquarium', 'horse', 'mascota', 'mascotas', 'animais', 'cachorro', 'gato', 'perro'],
  art: ['drawing', 'painting', 'illustration', 'sketch', 'design', 'pixel', 'digital art', 'artist', 'arte', 'desenho', 'pintura', 'dibujo', 'ilustración', 'ilustração'],
  photography: ['photo', 'photography', 'photographer', 'fotografia', 'fotografía', 'foto', 'photofeed', 'portrait', 'camera', 'lens', 'macro'],
  gaming: ['game', 'games', 'gaming', 'gamer', 'splinterlands', 'play2earn', 'p2e', 'esports', 'juego', 'juegos', 'jogo', 'jogos', 'videogame', 'minecraft', 'rpg'],
  crypto: ['crypto', 'cryptocurrency', 'bitcoin', 'ethereum', 'defi', 'blockchain', 'token', 'web3', 'altcoin', 'nft', 'airdrop', 'staking', 'criptomoedas', 'criptomonedas'],
  culture: ['culture', 'cultura', 'history', 'historia', 'história', 'tradition', 'heritage', 'language', 'idioma', 'religion', 'philosophy', 'filosofia', 'society', 'sociedad', 'sociedade'],
  diy: ['diy', 'craft', 'crafts', 'handmade', 'woodworking', 'knitting', 'crochet', 'sewing', 'tutorial', 'artesanato', 'manualidades', 'upcycle', 'maker'],
  education: ['education', 'learning', 'teaching', 'teacher', 'school', 'university', 'study', 'course', 'educação', 'educación', 'estudo', 'ensino', 'escuela', 'escola', 'universidad', 'universidade'],
  finance: ['finance', 'investing', 'investment', 'economy', 'trading', 'business', 'mercado', 'stocks', 'markets', 'entrepreneur', 'emprendedor', 'empreendedor', 'money', 'dinero', 'dinheiro', 'passive income', 'finanzas', 'finanças'],
  food: ['food', 'recipe', 'recipes', 'cooking', 'receita', 'receitas', 'comida', 'vegan', 'baking', 'drinks', 'coffee', 'cocktail', 'wine', 'beer', 'cocina', 'culinária', 'gastronomy', 'gastronomia'],
  health: ['health', 'wellness', 'yoga', 'meditation', 'mental health', 'nutrition', 'saúde', 'salud', 'medicine', 'medicina', 'therapy', 'healing', 'bienestar'],
  hive: ['witness', 'peakd', 'ecency', 'proposal', 'dapps', 'dao', 'hivebuzz', 'hive engine', 'leofinance', 'hivedevs', 'curation', 'curación', 'curadoria'],
  lifestyle: ['lifestyle', 'life style', 'mindfulness', 'parenting', 'family', 'fashion', 'beauty', 'daily life', 'vida', 'cotidiano', 'moda', 'familia', 'família'],
  media: ['media', 'movie', 'movies', 'film', 'films', 'cinema', 'series', 'anime', 'manga', 'comics', 'podcast', 'youtube', 'streaming', 'filmes', 'películas', 'news', 'noticias', 'notícias'],
  music: ['music', 'song', 'songs', 'audio', 'musica', 'música', 'beat', 'band', 'singer', 'guitar', 'lyrics', 'canción'],
  nature: ['nature', 'wildlife', 'garden', 'gardening', 'natureza', 'naturaleza', 'ecology', 'forest', 'plant', 'plants', 'flowers', 'environment', 'sustainability', 'permaculture', 'jardín', 'jardim'],
  politics: ['politics', 'political', 'freedom', 'liberty', 'censorship', 'government', 'política', 'libertarian', 'activism', 'rights', 'libertad', 'liberdade'],
  science: ['science', 'astronomy', 'space', 'physics', 'biology', 'chemistry', 'ciencia', 'ciência', 'research', 'cosmos'],
  sports: ['sport', 'sports', 'fitness', 'actifit', 'football', 'soccer', 'running', 'esporte', 'deporte', 'basketball', 'cycling', 'gym', 'futebol', 'fútbol', 'martial arts'],
  technology: ['technology', 'tech', 'coding', 'software', 'developer', 'linux', 'programming', 'python', 'stem', 'robotics', 'engineering', 'tecnologia', 'tecnología', 'artificial intelligence', 'hardware'],
  travel: ['travel', 'travels', 'viagem', 'viagens', 'viaje', 'viajes', 'tourism', 'turismo', 'backpack', 'worldmap', 'trip', 'adventure', 'vacation', 'wanderlust'],
  world: ['world', 'country', 'countries', 'city', 'regional', 'local', 'nation', 'latam', 'africa', 'asia', 'europe', 'brasil', 'brazil', 'venezuela', 'filipino', 'philippines', 'indonesia', 'mundo'],
  writing: ['writing', 'poetry', 'fiction', 'poesia', 'story', 'stories', 'literatura', 'books', 'book', 'literature', 'novel', 'author', 'reading', 'libros', 'livros', 'escritor', 'writers']
};

// Categorias genéricas que dão falso positivo: pontuação reduzida no fallback.
const CATEGORY_WEIGHT: Record<string, number> = {
  hive: 0.45,
  world: 0.5,
  culture: 0.7
};

/**
 * Comunidades já classificadas manualmente.
 * Formato: tag da categoria (de CATEGORY_DEFINITIONS, ou 'general') -> IDs numéricos
 * (o prefixo "hive-" é adicionado automaticamente).
 */
const KNOWN_IDS_BY_TAG: Record<string, number[]> = {
  animals: [181245, 168339, 133343, 141812, 156144, 187635, 124221, 125335, 113047, 101587, 106444, 196708, 189742, 181573],
  art: [166896, 122472, 171084, 158694, 178708, 126773, 186308, 156061, 113774, 122101, 163661, 161657, 120185, 179541, 142935, 115058, 183491, 155025, 154202, 140877, 142711, 196538, 180207, 189689, 134572, 102177, 174695, 122516, 177800, 156509, 102502, 174301, 184784, 131665, 139542, 106445, 177949, 22222, 109926, 177717, 151213],
  writing: [177032, 173638, 161465, 155350, 141488, 164671, 194866, 121077, 161155, 115590, 180164, 109873, 134134, 136450, 130808, 179291, 186424, 138388, 113187, 138326, 197467, 142367, 199275, 157795, 196487, 199493, 170798, 153503, 179230, 124999, 139324, 132410, 135483],
  crypto: [152804, 177956, 121834, 120117, 138698, 112281, 160482, 173575, 133310, 158611, 107130, 198952, 120516, 182156, 185702, 122828, 145789, 102371, 163253, 145537, 165553, 126009, 189312, 172447, 145209, 133011, 155986, 159259, 167922, 192162, 196064, 104206, 125568, 164632, 102770, 111011, 144059, 142415, 103179, 101145, 130351, 177307, 106130, 192111, 199857, 155221, 180571, 169382],
  culture: [132936, 194470, 181017, 128282, 151446, 153212, 109702, 172365, 133974, 157653, 171740, 126667, 134022, 199021, 115797, 117344, 151904],
  diy: [129017, 176634, 173726, 189641, 130560, 174422, 189504, 127911, 108629],
  education: [168912, 152587, 182967, 184648, 138376, 122108, 181450, 155451, 187448, 166055, 153850, 109584, 144782, 199420, 188262, 174400, 130636, 177423, 106919, 121314, 186239, 10701, 131257],
  finance: [159585, 144474, 140971, 101202, 197554, 154144, 112018, 19219, 180505, 171978, 105261, 183630, 115812, 151771, 155492, 111263, 182194, 106316, 136819, 181052, 152593, 119826, 131625, 143901, 163068, 134237, 139925, 107791],
  food: [189869, 187719, 120505, 140515, 161993, 152524, 131588, 195786, 173296, 140587, 164234, 111356, 109139, 104214, 111160, 161745, 120586, 138631, 141252, 118249, 100067, 136983, 187379, 115472, 180569, 185131],
  gaming: [102223, 107975, 131619, 11779, 147818, 190697, 196769, 184037, 127022, 131812, 100932, 155862, 179856, 135941, 122422, 133127, 195736, 136293, 149605, 132629, 168521, 145104, 105400, 189434, 173286, 1111111, 129755, 140217, 157640, 101135, 153170, 137757, 115120, 185167, 135853, 131131, 111086, 178250, 177888, 188270, 187087, 114305, 164784, 169191, 126911, 197488, 157335, 133578, 154356, 195370, 157129, 185703, 13323, 184309, 189497, 157286, 168374, 102963, 157136, 175317, 176993, 191258, 198683, 134794, 191038, 198197, 115712, 191961],
  hive: [18024, 146528, 163399, 110011, 186600, 173737, 160391, 184600, 148309, 111516, 164833, 110144, 156768, 193084, 108763, 193212, 133311, 191340, 148441, 180478, 150840, 193566, 177727, 104601, 191635, 126075, 111111, 152267, 157893, 102930, 154303, 122609, 116470, 151954, 185582, 122221, 192847, 167547, 189329, 178437, 133987, 162114, 138395, 170475, 183235, 114929, 139531, 104940, 106258, 107705, 197333, 130672, 185924, 109667, 133194, 124452, 189306, 195329, 174578, 146620, 111999, 171372, 125126, 150329, 102880, 196233, 185119, 110713, 178895, 173115, 179927, 178315, 124838, 186392, 165754, 177682, 101265, 14967, 125125, 131578, 181436],
  health: [193552, 110143, 105668, 196427, 176853, 165844, 194734, 177758, 198305, 143302, 185113, 125383, 183055, 121589, 130191, 150338, 105573, 115368, 195469, 112107, 120085, 100903, 119670, 122675, 125730, 120078, 172582, 101163, 111275, 123394, 196244, 107275, 166408, 109876, 153943, 152123, 117695, 172973],
  lifestyle: [153644, 127096, 195439, 100217, 113153, 151602, 110372, 149312, 116062, 127983, 178265, 141995, 151228, 151662, 184189, 102879, 159230, 108045, 184528, 180757, 190931, 184934, 140084, 115319, 35480, 114384, 183828, 171912, 133389, 123755, 111343, 172958, 150986, 131951, 152184, 108539, 125669, 122440, 141753, 115582, 156687, 155373, 144838, 187189, 104194, 103678, 174602, 193462, 188181, 165757, 152413, 179931, 119569, 113523, 168042, 154484, 126152, 104619, 127434, 107158, 114105, 194848, 174122, 178138, 157568, 176745, 192096, 173630, 143745, 143434, 168869, 195880, 177841, 111028],
  media: [112355, 123280, 156968, 123507, 195419, 155666, 121744, 101253, 164166, 133003, 196037, 101255, 122315, 151888, 155820, 145796, 17777, 103784, 191529, 109368, 150403, 135396, 186678, 168851, 185734, 166847, 108634, 128305, 152747, 118364, 109255, 136933, 188196, 184127, 122598, 194398, 113761, 149863, 158489, 115325, 142055, 181335, 102721, 169926, 110369, 161234, 155997, 171488, 151103, 150301, 135183],
  music: [195772, 144400, 179901, 124140, 176363, 193961, 121757, 143104, 129959, 118409, 176185, 150342, 153724, 164809, 100162, 192392, 141487, 105786, 110757, 168505, 190570, 135939, 193816, 169268, 111482, 120026, 175836, 192806, 158471, 183952, 148115, 169498, 185880, 140169],
  nature: [135100, 150280, 154065, 174680, 150210, 194421, 198415, 165007, 105967, 166168, 151327, 194323, 197995, 13366, 147663, 152367, 140635, 114308, 122727, 109939, 164027, 152514, 165890, 109160, 145540, 130906, 120883, 139358, 109666, 145264, 140641, 112482, 183841, 193614, 194700, 141827, 189277, 127788, 195708, 146431, 109038],
  general: [113089, 157655, 181465, 182398, 139838, 180559, 166850, 161428, 114345, 149278, 172673, 117711, 140662, 106482, 174323, 193949, 179509, 161645, 114236, 158152, 147177, 115963, 103153, 128773, 157865, 113115, 141165, 168088, 195212, 168689, 160243, 176217, 138307, 164923, 112787, 108514, 180658, 116655, 102066, 18786, 123987, 193071, 147762, 142010, 157821, 113967, 182074, 104024, 140621, 116692, 136480, 12390, 110490, 117752, 147625, 111050, 152200, 153726, 135032, 169287, 107801, 115628, 183196, 108278, 152889, 155014, 145322, 181925, 169485, 10005, 137823, 123585, 119335, 170744, 142376, 165962, 113359, 109288, 220022, 170068, 107190, 122419, 122026, 166030, 101750],
  photography: [118022, 120035, 142159, 150015, 181829, 193236, 152232, 164277, 195541, 185676, 133651, 156579, 164221, 147010, 131609, 15966, 151070, 145671, 127914, 181290, 163089, 181964, 156012, 145666, 14396, 134488, 153349, 141974, 165485, 142821, 182015, 119845, 194913, 121296, 127238, 175538, 173844, 119888, 179017, 102126, 114647, 192608, 134443, 137856, 108029, 146123, 116137, 189591, 132248, 156108],
  politics: [112627, 173062, 157746, 135547, 127572, 144722, 140440, 110786, 159722, 181057, 151714, 113182, 106474, 129940, 120417, 160545, 165423, 179804, 182169, 134468, 173475],
  technology: [123993, 153367, 193148, 146547, 143091, 184554, 202026, 143722, 155543, 107703, 109953, 159512, 138876, 154226, 197883, 123626, 193665, 115666, 181405, 125760, 150007, 115131, 106817, 172295, 149975, 186119, 186141, 155735, 152724, 116823, 128780, 122481, 117046, 178653, 136515, 120808, 169321, 175254, 129924, 154627, 173119, 161157, 170295, 163521, 184724, 111030, 173199, 127817, 102747, 127466, 103670, 106538, 196387, 154244, 108498, 196136, 116273, 141805, 196902, 103035, 114606, 152999],
  sports: [177745, 115900, 189157, 162239, 153018, 108225, 198677, 166990, 148416, 162337, 100736, 135376, 145940, 169212, 124594, 109272, 108943, 106687, 126508, 101690, 115814, 134564],
  travel: [167949, 117778, 140911, 136361, 165935, 190432, 196308, 118597, 163106, 152660, 113634, 191315, 153993, 168279, 184437, 104387, 155530, 190972, 163772, 173113, 100037, 166046],
  world: [141359, 116509, 163084, 190212, 118095, 127742, 174205, 162880, 199470, 103923, 154369, 133872, 127706, 192870, 169958, 121566, 138161, 189678, 180318, 172868, 136000, 106909, 187930, 105017, 191968, 121561, 122133, 161447, 197955, 199963, 110135, 190648, 10053, 115276, 118864, 192055, 158302, 105425, 125158, 155749, 147104, 11060, 188409, 114815, 107349, 169078, 150289, 11800, 188753, 195647, 126376, 190738, 180461, 127515, 193130, 176874, 132463, 112871, 107945, 186377, 180578, 107594, 153476, 186042, 197685, 104152, 104626, 196917, 123450, 196396, 143869, 141574, 189581, 129226, 134863, 117341, 100851, 155184, 106719, 108929, 165025, 120257, 134382, 117084, 120422, 190737, 130010, 127719, 174683, 115859, 165469, 123878, 151781, 173291, 109313, 160370, 114839, 171638, 166496, 138175, 132593, 128464]
};

// Monta o índice "hive-123456" -> tag uma única vez.
const KNOWN_CATEGORIES: Record<string, string> = (() => {
  const index: Record<string, string> = {};
  for (const [tag, ids] of Object.entries(KNOWN_IDS_BY_TAG)) {
    for (const id of ids) {
      index[`hive-${id}`] = tag;
    }
  }
  return index;
})();

function includesTerm(haystack: string, term: string): boolean {
  const needle = term.toLowerCase().trim();
  if (needle.length < 3) return false;
  if (needle.length >= 6) return haystack.includes(needle);
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, 'iu').test(haystack);
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

function classifyCategory(community: HiveCommunity): CategoryResult {
  // 1. Lista curada tem prioridade
  const knownTag = KNOWN_CATEGORIES[community.name];
  if (knownTag) {
    if (knownTag === GENERAL.categoryTag) return GENERAL;
    const knownDef = CATEGORY_DEFINITIONS.find((cat) => cat.tag === knownTag);
    if (knownDef) {
      return { categoryTag: knownDef.tag, categoryLabel: knownDef.label, categoryIcon: knownDef.icon };
    }
  }

  // 2. Fallback: pontuação por palavras-chave no título e na descrição
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
    score *= CATEGORY_WEIGHT[def.tag] ?? 1;
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