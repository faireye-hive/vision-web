import { describe, expect, it } from 'vitest';
import { hasUrlCredentials } from './urlSafety';

describe('credential-based domain disguises in user-posted links', () => {
  it.each([
    'https://ecency.com@evil.com/login',
    'http://ecency.com@evil.com/login',
    'https://ecency.com:password@evil.com/login',
    'https://:password@evil.com/login',
    'https://%65cency.com@evil.com/login',
    'https://ecency.com%40support@evil.com/login',
    'https://evil.com@ecency.com/@alice/post',
    '//ecency.com@evil.com/login',
    'https:\\\\ecency.com@evil.com/login',
    ' https://ecency.com@evil.com/login ',
    'https://ecency.com\t@evil.com/login',
  ])('blocks embedded credentials in %j', (url) => {
    expect(hasUrlCredentials(url)).toBe(true);
  });

  it.each([
    'https://ecency.com/@alice/post',
    'https://example.com/path/@alice',
    'https://example.com/?email=alice@example.com',
    'https://example.com/#alice@example.com',
    'https://example.com/path/ecency.com%40evil.com',
    '//ecency.com/@alice/post',
    '/post/@alice/post',
    '/profile/@alice',
    '#post-heading-1',
    'mailto:alice@example.com',
    '',
  ])('preserves ordinary URLs and @ outside the authority in %j', (url) => {
    expect(hasUrlCredentials(url)).toBe(false);
  });
});
