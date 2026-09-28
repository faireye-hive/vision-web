import { HivePost } from '../services/hiveApi';

export function postKey(post: HivePost): string {
  return `${post.author}/${post.permlink}`;
}

/** Append posts that are not already in `current`. Returns the same array when nothing new arrived. */
export function appendUniquePosts(current: HivePost[], incoming: HivePost[]): HivePost[] {
  if (incoming.length === 0) return current;

  const seen = new Set(current.map(postKey));
  const fresh: HivePost[] = [];
  for (const post of incoming) {
    const key = postKey(post);
    if (seen.has(key)) continue;
    seen.add(key);
    fresh.push(post);
  }

  return fresh.length === 0 ? current : [...current, ...fresh];
}
