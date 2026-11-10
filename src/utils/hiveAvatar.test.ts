import { describe, expect, it, vi } from 'vitest';
import { getHiveAvatarUrl, resolveHiveAvatarUrl } from './hiveAvatar';
import { AVATAR_PLACEHOLDER } from './imageFallback';

// URL construction runs in Node; sanitizing HTML is exercised in the browser.
vi.mock('dompurify', () => ({ default: { addHook: vi.fn() } }));

describe('Hive avatar source', () => {
  it('uses Hive.blog through the existing safe proxy for every avatar size', () => {
    for (const [size, width] of [['small', '80'], ['medium', '200'], ['large', '400']] as const) {
      const url = new URL(getHiveAvatarUrl(' @SM-SILVA ', size));
      expect(url.hostname).toBe('wsrv.nl');
      expect(url.searchParams.get('url')).toBe(`images.hive.blog/u/sm-silva/avatar/${size}`);
      expect(url.searchParams.get('w')).toBe(width);
    }
    expect(getHiveAvatarUrl('')).toBe(AVATAR_PLACEHOLDER);
  });

  it('migrates cached Ecency avatar endpoints without replacing custom profile images', () => {
    for (const suffix of ['', '/small', '/medium/', '/large']) {
      const migrated = resolveHiveAvatarUrl(`https://images.ecency.com/u/sm-silva/avatar${suffix}`, 'sm-silva');
      expect(migrated).toBe(getHiveAvatarUrl('sm-silva'));
      expect(migrated).not.toContain('ecency');
    }
    const customImage = 'https://i.ecency.com/profile-photo.png';
    expect(resolveHiveAvatarUrl(customImage, 'sm-silva')).toBe(customImage);
    expect(resolveHiveAvatarUrl(undefined, 'sm-silva')).toBe(getHiveAvatarUrl('sm-silva'));
  });
});
