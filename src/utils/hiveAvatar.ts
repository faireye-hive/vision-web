import { AVATAR_PLACEHOLDER } from './imageFallback';
import { getSafeImageUrl } from './sanitize';

export type HiveAvatarSize = 'small' | 'medium' | 'large';

/** Serve account avatars through Hive.blog and the existing safe image proxy. */
export function getHiveAvatarUrl(username: string, size: HiveAvatarSize = 'medium'): string {
  const clean = (username || '').trim().replace(/^@/, '').toLowerCase();
  if (!clean) return AVATAR_PLACEHOLDER;
  const direct = `https://images.hive.blog/u/${encodeURIComponent(clean)}/avatar/${size}`;
  return getSafeImageUrl(direct, { width: size === 'small' ? 80 : size === 'medium' ? 200 : 400 }) || direct;
}

/** Preserve custom profile images while migrating legacy Ecency avatar URLs. */
export function resolveHiveAvatarUrl(imageUrl: string | undefined, username: string, size: HiveAvatarSize = 'medium'): string {
  if (!imageUrl) return getHiveAvatarUrl(username, size);
  try {
    const url = new URL(imageUrl);
    if (url.hostname === 'images.ecency.com' && /^\/u\/[^/]+\/avatar(?:\/(?:small|medium|large))?\/?$/.test(url.pathname)) {
      return getHiveAvatarUrl(username, size);
    }
  } catch { /* Existing custom image handling remains with the caller. */ }
  return imageUrl;
}
