import { describe, expect, it } from 'vitest';
import { applyContentFilter, checkPostFiltered, ContentFilterConfig } from './contentFilter';
import { filterCommentTree } from './contentVisibility';
import type { HivePost } from '../services/hiveApi';
const config: ContentFilterConfig = { enabled: false, words: [], authors: [] };
const post = (author: string) => ({ author, title: '', body: '', category: '' } as HivePost);

describe('on-chain mute enforcement', () => {
  it('hides muted authors even when optional filters are off', () => {
    expect(checkPostFiltered(post('@Muted'), config, new Set(['muted']))).toMatchObject({ filtered: true, reason: 'author' });
    expect(checkPostFiltered(post('visible'), config, new Set(['muted']))).toEqual({ filtered: false });
  });
  it('filters cached feed items and counts chain mutes with optional filters off', () => {
    const result = applyContentFilter([post('muted'), post('visible')], config, new Set(['muted']));
    expect(result.visiblePosts.map(item => item.author)).toEqual(['visible']);
    expect(result.hiddenByAuthorCount).toBe(1);
  });
  it('preserves word filtering alongside mandatory mutes', () => {
    const result = applyContentFilter([{ ...post('visible'), title: 'spam' }, post('muted'), post('safe')], { ...config, enabled: true, words: ['spam'] }, new Set(['muted']));
    expect(result.visiblePosts.map(item => item.author)).toEqual(['safe']);
    expect(result.hiddenByWordCount).toBe(1);
    expect(result.hiddenByAuthorCount).toBe(1);
  });
  it('updates visibility when an author is unmuted', () => {
    expect(applyContentFilter([post('muted')], config, new Set()).visiblePosts).toHaveLength(1);
  });
  it('removes muted replies at every depth and retains visible siblings', () => {
    interface Node { comment: { author: string }; replies: Node[] }
    const tree: Node[] = [{ comment: { author: 'visible' }, replies: [
      { comment: { author: 'muted' }, replies: [{ comment: { author: 'descendant' }, replies: [] }] },
      { comment: { author: 'safe' }, replies: [] }
    ] }, { comment: { author: 'muted' }, replies: [] }];
    const visible = filterCommentTree(tree, author => author === 'muted');
    expect(visible).toHaveLength(1);
    expect(visible[0].replies.map(node => node.comment.author)).toEqual(['safe']);
    expect(tree[0].replies).toHaveLength(2);
  });
});
