/**
 * Free Markdown & Text Translation Service
 *
 * Uses the free Google Translate (GTX) engine with automatic fallback
 * to MyMemory Translation API.
 *
 * Preserves Markdown syntax:
 * - Code blocks (```lang ... ```)
 * - Inline code (`...`)
 * - Images (![alt](url))
 * - Link URLs [text](url) -> translates label, keeps url intact
 * - HTML tags (<img>, <div>, <center>, <iframe>, etc.)
 * - Raw URLs and video facades
 * - Paragraph breaks and headings (#, ##, ###, lists, blockquotes)
 */

export interface TranslationTarget {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const POPULAR_TRANSLATION_LANGUAGES: TranslationTarget[] = [
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹' },
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'uk', name: 'Ukrainian', nativeName: 'Українська', flag: '🇺🇦' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
];

/** In-memory cache for translated strings */
const translationCache = new Map<string, string>();

/** Helper to mask Markdown entities with unambiguous alphanumeric tokens */
function maskMarkdown(
  text: string,
  placeholders: Array<{ id: string; raw: string }>
): string {
  let masked = text;

  // 1. Code blocks ```lang\n...```
  masked = masked.replace(/```[\s\S]*?```/g, (match) => {
    const id = `XZPHCB${placeholders.length}XZ`;
    placeholders.push({ id, raw: match });
    return id;
  });

  // 2. Inline code `...`
  masked = masked.replace(/`[^`\n]+`/g, (match) => {
    const id = `XZPHIC${placeholders.length}XZ`;
    placeholders.push({ id, raw: match });
    return id;
  });

  // 3. Markdown images ![alt](url)
  masked = masked.replace(/!\[([\s\S]*?)\]\((https?:\/\/[^\s\)]+)\)/g, (match) => {
    const id = `XZPHIM${placeholders.length}XZ`;
    placeholders.push({ id, raw: match });
    return id;
  });

  // 4. Markdown links [text](url) -> protect only the URL destination
  masked = masked.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (_m, linkText, url) => {
    const id = `XZPHLK${placeholders.length}XZ`;
    placeholders.push({ id, raw: url });
    return `[${linkText}](${id})`;
  });

  // 5. HTML tags <...>
  masked = masked.replace(/<[^>]+>/g, (match) => {
    const id = `XZPHTG${placeholders.length}XZ`;
    placeholders.push({ id, raw: match });
    return id;
  });

  // 6. Standalone URLs
  masked = masked.replace(/(https?:\/\/[^\s<"'\)]+)/g, (match) => {
    const id = `XZPHUR${placeholders.length}XZ`;
    placeholders.push({ id, raw: match });
    return id;
  });

  return masked;
}

/** Helper to restore all masked Markdown entities */
function unmaskMarkdown(
  text: string,
  placeholders: Array<{ id: string; raw: string }>
): string {
  let unmasked = text;
  for (const p of placeholders) {
    unmasked = unmasked.split(p.id).join(p.raw);
    // Relaxed fallback if translation engine introduced casing or spaces inside token
    const tokenName = p.id.slice(2, -2);
    const looseRegex = new RegExp(`XZ\\s*${tokenName}\\s*XZ`, 'gi');
    unmasked = unmasked.replace(looseRegex, p.raw);
  }
  return unmasked;
}

/**
 * Free translation engine request via Google Translate GTX API
 */
async function fetchGtxTranslation(text: string, targetLang: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(
    targetLang
  )}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Google Translate responded with ${res.status}`);
  }
  const json = await res.json();
  if (Array.isArray(json?.[0])) {
    return json[0].map((segment: any) => (segment?.[0] ? String(segment[0]) : '')).join('');
  }
  throw new Error('Unexpected translation response format');
}

/**
 * Free fallback translation engine via MyMemory API
 */
async function fetchMyMemoryTranslation(text: string, targetLang: string): Promise<string> {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    text
  )}&langpair=en|${encodeURIComponent(targetLang)}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`MyMemory responded with ${res.status}`);
  }
  const json = await res.json();
  if (json?.responseData?.translatedText) {
    return json.responseData.translatedText;
  }
  throw new Error('No translated text from MyMemory');
}

/**
 * Low-level text translation with automatic engine fallback
 */
async function translateTextRaw(text: string, targetLang: string): Promise<string> {
  if (!text || !text.trim()) return text;
  try {
    return await fetchGtxTranslation(text, targetLang);
  } catch (gtxErr) {
    console.warn('Google Translate error, falling back to MyMemory:', gtxErr);
    try {
      return await fetchMyMemoryTranslation(text, targetLang);
    } catch (fallbackErr) {
      console.error('All free translation providers failed:', fallbackErr);
      throw fallbackErr;
    }
  }
}

/**
 * Translates a short string (e.g. title, snippet, selected sentence)
 */
export async function translateText(text: string, targetLang: string = 'pt'): Promise<string> {
  if (!text || !text.trim()) return text;
  const cacheKey = `${targetLang}:text:${text}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  const placeholders: Array<{ id: string; raw: string }> = [];
  const masked = maskMarkdown(text, placeholders);
  const rawTranslated = await translateTextRaw(masked, targetLang);
  const result = unmaskMarkdown(rawTranslated, placeholders);

  translationCache.set(cacheKey, result);
  return result;
}

/**
 * Translates a complete Markdown document while preserving its syntax,
 * formatting, code blocks, images, HTML tags, and link destinations.
 */
export async function translateMarkdown(
  markdown: string,
  targetLang: string = 'pt',
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!markdown || !markdown.trim()) return markdown;
  const cacheKey = `${targetLang}:md:${markdown}`;
  if (translationCache.has(cacheKey)) {
    if (onProgress) onProgress(100);
    return translationCache.get(cacheKey)!;
  }

  // Split markdown into logical blocks / paragraphs separated by \n\n
  const rawBlocks = markdown.split(/\n\s*\n/);
  const placeholders: Array<{ id: string; raw: string }> = [];

  const maskedBlocks = rawBlocks.map((b) => maskMarkdown(b, placeholders));

  // Batch blocks into chunks of ~1500 chars to avoid exceeding request size limits
  // while minimizing network round-trips for high speed
  const DELIMITER = '\n\nXZDELIM888XZ\n\n';
  const batches: string[][] = [];
  let currentBatch: string[] = [];
  let currentLen = 0;

  for (const block of maskedBlocks) {
    if (currentLen + block.length + DELIMITER.length > 499 && currentBatch.length > 0) {
      batches.push(currentBatch);
      currentBatch = [block];
      currentLen = block.length;
    } else {
      currentBatch.push(block);
      currentLen += block.length + DELIMITER.length;
    }
  }
  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  let completedBatches = 0;
  const totalBatches = batches.length;

  // Process batches with high parallelism
  const translatedBatches = await Promise.all(
    batches.map(async (batch) => {
      // If the batch only has protected entities and no readable text, keep it as is
      const joined = batch.join(DELIMITER);
      const containsTranslatableText = /[a-zA-Z\u00C0-\u017F]{2,}/.test(joined);
      if (!containsTranslatableText) {
        completedBatches++;
        if (onProgress) onProgress(Math.round((completedBatches / totalBatches) * 100));
        return batch.join('\n\n');
      }

      try {
        const rawTranslated = await translateTextRaw(joined, targetLang);
        const parts = rawTranslated.split(/XZ\s*DELIM888\s*XZ/i);
        completedBatches++;
        if (onProgress) onProgress(Math.round((completedBatches / totalBatches) * 100));

        if (parts.length === batch.length) {
          return parts.map((p) => p.trim()).join('\n\n');
        }
        return rawTranslated;
      } catch (err) {
        console.error('Batch translation failed, returning original batch:', err);
        completedBatches++;
        if (onProgress) onProgress(Math.round((completedBatches / totalBatches) * 100));
        return batch.join('\n\n');
      }
    })
  );

  const fullRawTranslated = translatedBatches.join('\n\n');
  const finalResult = unmaskMarkdown(fullRawTranslated, placeholders);

  translationCache.set(cacheKey, finalResult);
  return finalResult;
}
