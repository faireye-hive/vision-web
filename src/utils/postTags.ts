import { HivePost } from '../services/hiveApi';

const NOISE_TAGS = new Set([
  'hive',
  'blog',
  'ecency',
  'peakd',
  'neoxian',
  'palnet',
  'marlians',
  'ctp',
  'zzan',
  'dblog',
  'life',
  'post'
]);

export function isNoiseTag(tag: string): boolean {
  return NOISE_TAGS.has(tag.toLowerCase());
}

export function extractPostTags(post: HivePost): string[] {
  const tags: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== 'string') return;
    const clean = value.trim().toLowerCase().replace(/^#/, '');
    if (!clean || clean.startsWith('hive-') || tags.includes(clean)) return;
    tags.push(clean);
  };

  try {
    const meta = typeof post.json_metadata === 'string'
      ? JSON.parse(post.json_metadata)
      : post.json_metadata;
    const list = meta?.tags;
    if (Array.isArray(list)) {
      list.forEach(push);
    }
  } catch {
    // Metadata is optional and sometimes malformed.
  }

  push(post.category);
  return tags.slice(0, 12);
}

export function postCommunity(post: HivePost): { name: string; title: string } | null {
  const name = post.community || (post.category?.startsWith('hive-') ? post.category : '');
  if (!name) return null;
  return {
    name,
    title: post.community_title || name
  };
}
