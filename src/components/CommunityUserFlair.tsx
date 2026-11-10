import { useEffect, useState } from 'react';
import { HivePost, hiveRpcCall } from '../services/hiveApi';
import { fetchWithCache } from '../services/apiCache';
import { postCommunity } from '../services/communityFeatures';

export function CommunityUserFlair({ post }: { post: HivePost }) {
  const community = postCommunity(post);
  const [fallback, setFallback] = useState<{ key: string; title: string } | null>(null);
  const key = `${community}/${post.author}`;
  useEffect(() => {
    if (!community || post.author_title !== undefined) return;
    let active = true;
    fetchWithCache(`community-user:${key}`, () => hiveRpcCall<{ title?: string }>('bridge.get_community_context', { name: community, account: post.author }), { ttl: 60000 })
      .then(value => { if (active) setFallback({ key, title: value?.title || '' }); }).catch(() => {});
    return () => { active = false; };
  }, [community, key, post.author, post.author_title]);
  const title = post.author_title ?? (fallback?.key === key ? fallback.title : '');
  if (!community || !title) return null;
  return <span title={`Community flair: ${title}`} className="inline-flex max-w-40 truncate rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">{title}</span>;
}
