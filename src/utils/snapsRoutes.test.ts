import { describe, expect, it } from 'vitest';
import { legacySnapsRedirect } from './snapsRoutes';
describe('independent Snaps routes', () => {
  it('preserves shared conversations, channel and focus when migrating an old link', () => {
    const result = legacySnapsRedirect('/shorts', '?mode=json&snap=alice%2F123&channel=alice%2Fart&focus=bob%2F456');
    const url = new URL(result!, 'https://example.com');
    expect(url.pathname).toBe('/snaps');
    expect(url.searchParams.get('snap')).toBe('alice/123');
    expect(url.searchParams.get('channel')).toBe('alice/art');
    expect(url.searchParams.get('focus')).toBe('bob/456');
    expect(url.searchParams.has('mode')).toBe(false);
  });
  it('keeps ordinary Shorts and legacy reward snap links in their original product', () => {
    expect(legacySnapsRedirect('/shorts', '')).toBeNull();
    expect(legacySnapsRedirect('/shorts/@alice/a-snap', '?mode=json')).toBeNull();
    expect(legacySnapsRedirect('/shorts', '?mode=rewards')).toBe('/shorts');
  });
  it('does not redirect the independent page', () => {
    expect(legacySnapsRedirect('/snaps', '?channel=alice/art')).toBeNull();
  });
});
