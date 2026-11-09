const TRUSTED_COMMENT_LINK_HOSTS = [
  'peakd.com',
  'ecency.com',
  'hive.blog',
  '3speak.tv',
  '3speak.com',
  '3speak.online'
];

const SUSPICIOUS_COMMENT_TERMS = /\b(?:airdrop|giveaway|free\s+(?:tokens?|hive|hbd)|claim\s+(?:now|your|free)|connect\s+(?:your\s+)?wallet|verify\s+(?:your\s+)?wallet|seed\s+phrase|private\s+key)\b/i;

function isExternalCommentHref(href: string): boolean {
  if (/^(?:\/|#|mailto:|tel:)/i.test(href) && !href.startsWith('//')) return false;
  try {
    const url = new URL(href, 'https://nebulosa.invalid');
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    const host = url.hostname.toLowerCase().replace(/^www\./, '');
    return !TRUSTED_COMMENT_LINK_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function findExternalCommentLinks(html: string): Array<{ start: number; end: number }> {
  const matches: Array<{ start: number; end: number }> = [];
  const anchorPattern = /<a\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = anchorPattern.exec(html))) {
    const href = match[1].match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !isExternalCommentHref(href.replace(/&amp;/g, '&'))) continue;
    const closingAnchor = /<\/a>/gi;
    closingAnchor.lastIndex = anchorPattern.lastIndex;
    const closeMatch = closingAnchor.exec(html);
    if (closeMatch) matches.push({ start: match.index, end: closeMatch.index + closeMatch[0].length });
  }
  return matches;
}

export function hasSuspiciousCommentLanguage(body: string): boolean {
  return SUSPICIOUS_COMMENT_TERMS.test(body || '');
}

export function hasScamCommentSignals(body: string, sanitizedHtml: string): boolean {
  return hasSuspiciousCommentLanguage(body) && findExternalCommentLinks(sanitizedHtml).length > 0;
}

export function disableExternalCommentLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (anchor, attributes: string, label: string) => {
    const href = attributes.match(/\bhref\s*=\s*(["'])(.*?)\1/i)?.[2];
    if (!href || !isExternalCommentHref(href.replace(/&amp;/g, '&'))) return anchor;
    return `<span class="comment-scam-link" title="Blocked: suspicious external link">${label}</span>`;
  });
}
