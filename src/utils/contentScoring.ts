import { HivePost } from '../services/hiveApi';

/**
 * Calculates a custom quality score for ranking posts in Trending and Hot feeds.
 */
export function calculatePostScore(
  post: HivePost,
  sort: 'trending' | 'hot' | 'created' | string
): number {
  if (sort === 'created') {
    return new Date(post.created).getTime();
  }

  let score = 0;
  const comments = post.children || 0;
  const author = post.author || '';
  const title = (post.title || '').trim();
  const lowerTitle = title.toLowerCase();
  const category = (post.category || '').toLowerCase();
  const wordCount = lowerTitle.split(/\s+/).filter(Boolean).length;

  // 1. Engajamento por Comentários
  if (sort === 'trending') {
    score += comments * 15;
    if (comments >= 50) score += 200;
    else if (comments >= 25) score += 120;
    else if (comments >= 10) score += 80;
  } else {
    // Hot
    score += comments * 10;
    if (comments >= 15) score += 80;
    else if (comments >= 5) score += 40;
    else if (comments >= 3) score += 30;
    else if (comments >= 1) score += 20;
  }

  // 2. Filtro de Autores de Bot / Snaps

  const SPAM_OR_BOT_ACCOUNTS = new Set([
    'peak.snaps',
    'ecency.waves',
    'buildawhale'
  ]);
  if (SPAM_OR_BOT_ACCOUNTS.has(author.toLowerCase())) {
    score -= 10000;
  }
  // 3. Penalidade de Diários / Relatórios / Automatizados
  const dailyMatches = lowerTitle.match(
    /\b(daily|diario|diário|resumen|puzzle|container|report|relatorio|relatório|reporte|curación|curacion|actifit|rewards|evaluation|vyhodnocení)\b/gi
  );
  const matchCount = dailyMatches ? dailyMatches.length : 0;
  if (matchCount > 0) {
    score -= matchCount * 140;
  }

  // 4. Penalidade de Numeração de Rotação / Edição Contest / Datas em Série
  // Ex: #188, round 188, 27/09/2026, #20/7
  const hasSeriesOrDate = /(#\d+|round\s*\d+|\b\d{1,2}[\/\.-]\d{1,2}[\/\.-]\d{2,4}\b|\bday\s*\d+)/i.test(lowerTitle);
  if (hasSeriesOrDate) {
    score -= 60;
  }

  // 5. Penalidade para Hashtags e Barras em Excesso
  const hasHashtagOrSlash = /[#\/]\w+/i.test(title);
  if (hasHashtagOrSlash) {
    score -= 80;
  }

  // 6. Bônus para Títulos Orgânicos / Artigos / Código / Reflexões
  // Impulsiona os posts que você quer no topo
  const qualityKeywords = /\b(source code|github|crypto space|retrofuturism|forgotten year|surprising|marvelous|creations|seductive|power|competition)\b/i.test(lowerTitle);
  if (qualityKeywords) {
    score += 90;
  }

///////////////
  // 1. Tratamento seguro dos Reblogs (suporta número ou Array)
  const reblogCount = Array.isArray(post.reblog_entries) 
    ? post.reblog_entries.length 
    : (typeof post.reblog_entries === 'number' ? post.reblog_entries : 0);

  // Bônus por Reblog (ex: +25 pontos por cada reblog, limitado a +150 no total)
  if (reblogCount > 0) {
    score += Math.min(reblogCount * 25, 150);
  }

  // 2. Pontuação por Categoria / Comunidade
  

  // Lista de comunidades/tags prioritárias de alto valor (Dev, Arte, Ensaios, Fotografia)
  const highQualityCategories = [
    'hive-169321', // Hive Devs / Open Source
    'hive-156509', // On Chain Art
    'hive-143901', // tradfi
    'hive-153850', //hivelearn
    'hive-126152', //reflexions
    'programming',
    'coding',
    'technology',
    'photography',
    'writing'
  ];

  // Lista de comunidades focadas em relatórios diários (penalização suave se não capturado pelo título)
  const automatedCategories = [
    'hive-193552', // Actifit
    'actifit'
  ];

  if (highQualityCategories.includes(category)) {
    score += 80; // Bônus direto para categorias de alto valor
  } else if (automatedCategories.includes(category)) {
    score -= 100; // Penalidade por categoria de relatórios
  }

  return score;
}

export function qualifiesForTrending(post: HivePost): boolean {
  return (post.children || 0) >= 10;
}

export function rankPostsByCustomAlgorithm(
  posts: HivePost[],
  sort: 'trending' | 'hot' | 'created' | string,
  enforceTrendingMinComments: boolean = false
): HivePost[] {
  if (sort === 'created') {
    return [...posts];
  }

  let candidates = [...posts];

  if (sort === 'trending' && enforceTrendingMinComments) {
    const qualifying = candidates.filter(qualifiesForTrending);
    if (qualifying.length > 0) {
      candidates = qualifying;
    }
  }

  return candidates.sort((a, b) => {
    const scoreA = calculatePostScore(a, sort);
    const scoreB = calculatePostScore(b, sort);
    return scoreB - scoreA;
  });
}