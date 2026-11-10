import { describe, expect, it } from 'vitest';
import { communityNameFromPath, communityPath } from './communityRoutes';

describe('public community addresses', () => {
  it('restores a community from a direct link, including trailing slash and encoded names', () => {
    expect(communityNameFromPath('/c/hive-163772')).toBe('hive-163772');
    expect(communityNameFromPath('/c/HIVE-163772/')).toBe('hive-163772');
    expect(communityNameFromPath('/c/%68ive-163772')).toBe('hive-163772');
    expect(communityPath(' HIVE-163772 ')).toBe('/c/hive-163772');
  });
  it.each(['/c/', '/c/%E0%A4%A', '/c/hive-123/extra', '/c/hive-123%2Fother', '/c/javascript:alert(1)', '/c/%3Cscript%3E', '/c/ordinary-account', '/communities'])('rejects malformed or non-community routes: %s', path => {
    expect(communityNameFromPath(path)).toBe('');
  });
});
