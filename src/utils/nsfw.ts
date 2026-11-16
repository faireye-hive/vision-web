import { COMMUNITY_NAME } from './communityRoutes';

interface ContentLabels {
  is_nsfw?: unknown;
  tags?: unknown;
  json_metadata?: unknown;
  category?: unknown;
  community?: unknown;
  body?: unknown;
  title?: unknown;
}

const NSFW_HASHTAG = /(?:^|[^\p{L}\p{N}_/#])#nsfw(?![\p{L}\p{N}_-])/iu;

function isNsfwTag(value: unknown): boolean {
  return typeof value === 'string' && value.trim().toLowerCase().replace(/^#/, '') === 'nsfw';
}

function hasNsfwTag(tags: unknown): boolean {
  return Array.isArray(tags) ? tags.some(isNsfwTag) : isNsfwTag(tags);
}

function hasNsfwFlag(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === '1';
}

export function getContentCommunity(content: ContentLabels | null | undefined): string | undefined {
  for (const value of [content?.community, content?.category]) {
    if (typeof value !== 'string') continue;
    const name = value.trim().toLowerCase();
    if (COMMUNITY_NAME.test(name)) return name;
  }
}

export function isNsfwContent(content: ContentLabels | null | undefined): boolean {
  if (!content) return false;
  if (hasNsfwFlag(content.is_nsfw) || hasNsfwTag(content.tags)
    || isNsfwTag(content.category) || isNsfwTag(content.community)) return true;

  let metadata = content.json_metadata;
  if (typeof metadata === 'string') {
    try { metadata = JSON.parse(metadata); }
    catch { metadata = null; }
  }
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const { tags, nsfw, is_nsfw } = metadata as { tags?: unknown; nsfw?: unknown; is_nsfw?: unknown };
    if (hasNsfwTag(tags) || hasNsfwFlag(nsfw) || hasNsfwFlag(is_nsfw)) return true;
  }

  return [content.title, content.body].some(value => typeof value === 'string' && NSFW_HASHTAG.test(value));
}
