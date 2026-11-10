import type { SyntheticEvent } from 'react';
import { describe, expect, it } from 'vitest';
import { AVATAR_PLACEHOLDER, handleImageFallback } from './imageFallback';

function failedImage(src: string) {
  const attributes = new Map([['src', src], ['srcset', `${src} 2x`]]);
  const requests: string[] = [];
  const image = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    removeAttribute: (name: string) => attributes.delete(name),
    set src(value: string) {
      attributes.set('src', value);
      requests.push(value);
    }
  } as unknown as HTMLImageElement;
  const event = { currentTarget: image } as SyntheticEvent<HTMLImageElement>;
  return { event, attributes, requests };
}

describe('failed image fallback', () => {
  it('stops requesting images even when the placeholder also reports an error', () => {
    const { event, attributes, requests } = failedImage('https://images.ecency.com/u/hive/avatar/small/');
    for (let error = 0; error < 20; error++) handleImageFallback(event);

    expect(requests).toEqual([AVATAR_PLACEHOLDER]);
    expect(attributes.has('srcset')).toBe(false);
    expect(AVATAR_PLACEHOLDER).not.toMatch(/^https?:/);
  });

  it('tries an optional alternate image once, then stops at the local placeholder', () => {
    const { event, requests } = failedImage('https://example.com/thumbnail.jpg');
    const avatar = 'https://images.ecency.com/u/alice/avatar/small';
    for (let error = 0; error < 20; error++) handleImageFallback(event, avatar);

    expect(requests).toEqual([avatar, AVATAR_PLACEHOLDER]);
  });

  it('handles a different image assigned later to the same element', () => {
    const { event, requests } = failedImage('https://example.com/alice.png');
    handleImageFallback(event);
    event.currentTarget.src = 'https://example.com/bob.png';
    handleImageFallback(event);

    expect(requests).toEqual([AVATAR_PLACEHOLDER, 'https://example.com/bob.png', AVATAR_PLACEHOLDER]);
  });
});
