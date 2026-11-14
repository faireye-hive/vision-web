import type { HivePost } from './hiveApi';
import { fetchJsonWithTimeout } from './http';

const FEED_URL = 'https://api.syncad.com/haf-fyp-api/v1/fyp/feed/';
const PAGE_SIZE = 20;

type FeedEntry = Omit<HivePost, 'post_id'> & {
  fyp: { post_id: string | number; source: string };
};

export async function getHafRecommendedFeed(
  username: string,
  language: string,
  page: number,
  signal: AbortSignal
) {
  const url = new URL(encodeURIComponent(username), FEED_URL);
  url.searchParams.set('page', String(page));
  url.searchParams.set('page-size', String(PAGE_SIZE));
  if (language !== 'global') url.searchParams.set('language', language);

  const entries = await fetchJsonWithTimeout<FeedEntry[]>(url.toString(), { signal, cache: 'no-store' });
  if (!Array.isArray(entries)) throw new Error('Invalid response from the recommended feed.');

  // HAF returns full Bridge posts, with the numeric Hive ID nested in `fyp`.
  const posts: HivePost[] = entries.map(({ fyp, ...post }) => {
    const postId = Number(fyp?.post_id);
    if (!Number.isSafeInteger(postId) || postId <= 0 || !post.author || !post.permlink) {
      throw new Error('Invalid post in the recommended feed.');
    }
    return { ...post, post_id: postId };
  });

  return { posts, hasMore: entries.length === PAGE_SIZE, personalized: entries[0]?.fyp.source === 'personalized' };
}
