export function getCleanSnapText(body: string): string {
  if (!body) return '';
  let text = body;

  // 1. Remove markdown images: ![alt](url)
  text = text.replace(/!\[.*?\]\((?:https?:\/\/[^\s\)]+|[^\s\)]+)\)/gi, '');

  // 2. Remove HTML image and media tags: <img ...>, <video ...>, <iframe ...>
  text = text.replace(/<(?:img|video|iframe|audio|source)[^>]*\/?>/gi, '');

  // 3. For markdown links [visible text](url), keep only 'visible text'
  text = text.replace(/\[(.*?)\]\((?:https?:\/\/[^\s\)]+|[^\s\)]+)\)/gi, '$1');

  // 4. Remove raw URLs (http / https)
  text = text.replace(/https?:\/\/[^\s<>"')]+/gi, '');

  // 5. Remove any remaining HTML tags
  text = text.replace(/<[^>]+>/gi, '');

  // 6. Remove bot/app footer signatures
  text = text.replace(/<sub>.*?<\/sub>/gi, '');

  return text.trim();
}

/**
 * Returns character count of clean text, excluding links and images.
 */
export function getCleanSnapTextLength(body: string): number {
  return getCleanSnapText(body).length;
}
