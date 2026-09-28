/**
 * SHORTS API SERVICE
 *
 * Powers the Twitter/microblogging "Shorts" feed by retrieving short-form
 * community snaps published to the Hive blockchain under @peak.snaps container posts.
 *
 * Architecture:
 * 1. @peak.snaps posts periodic container posts (depth 0).
 * 2. Community members publish short-form snaps as top-level comments (depth 1).
 * 3. Replies to snaps are subcomments (depth >= 2).
 * 4. As users scroll to the end of a container's snaps, the next container is automatically loaded.
 */

import { hiveRpcCall, HivePost, getDiscussion, getAccountPosts, getFollowedCommentsFeed } from './hiveApi';
import { fetchWithCache, apiCache, CACHE_TTL } from './apiCache';

function hiveTime(value: string | undefined): number {
  if (!value) return 0;
  const safe = value.endsWith('Z') ? value : `${value}Z`;
  const time = new Date(safe).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export interface PeakSnapsContainer {
  author: string;
  permlink: string;
  title: string;
  created: string;
  children: number;
  payout: number;
  is_paidout?: boolean;
}

export interface ContainerSnapsResult {
  container: PeakSnapsContainer;
  snaps: HivePost[];
  discussionMap: Record<string, HivePost>;
}

/**
 * Fetch container posts published by @peak.snaps
 */
function isSnapComment(post: HivePost): boolean {
  return (post.parent_author || '').toLowerCase() === 'peak.snaps';
}

/**
 * Snaps written by people you follow, taken from the followed-comments feed.
 * That feed is already cached; this only keeps comments whose parent is @peak.snaps.
 */
export async function loadFollowingSnaps(account: string): Promise<HivePost[]> {
  if (!account) return [];
  const comments = await getFollowedCommentsFeed(account);
  return comments.filter(isSnapComment);
}

/**
 * Replies to snaps this account wrote.
 * bridge.get_account_posts sort=replies. A snap reply carries @peak.snaps in its url.
 */
export async function loadRepliesToAccount(account: string): Promise<HivePost[]> {
  const me = account.replace(/^@/, '').trim().toLowerCase();
  if (!me) return [];
  const replies = await getAccountPosts('replies', me, 40);
  return replies
    .filter((post) => {
      if ((post.parent_author || '').toLowerCase() !== me) return false;
      return (post.url || '').toLowerCase().includes('@peak.snaps/');
    })
    .sort((a, b) => hiveTime(b.created) - hiveTime(a.created));
}

export async function getPeakSnapsContainers(
  limit: number = 10,
  startAuthor?: string,
  startPermlink?: string,
  forceRefresh: boolean = false
): Promise<PeakSnapsContainer[]> {
  const cacheKey = `peak_snaps_containers:${limit}:${startAuthor || 'none'}:${startPermlink || 'none'}`;

  return fetchWithCache(
    cacheKey,
    async () => {
      const params: Record<string, any> = {
        sort: 'posts',
        account: 'peak.snaps',
        limit
      };

      if (startAuthor && startPermlink) {
        params.start_author = startAuthor;
        params.start_permlink = startPermlink;
      }

      const posts = await hiveRpcCall<any[]>('bridge.get_account_posts', params);
      if (!Array.isArray(posts)) return [];

      // Filter to container posts and map essential properties
      return posts
        .filter((p) => p && p.permlink && p.permlink.startsWith('snap-container-'))
        .map((p) => ({
          author: p.author || 'peak.snaps',
          permlink: p.permlink,
          title: p.title || 'Snaps Container',
          created: p.created || '',
          children: p.children || 0,
          payout: Number(p.payout) || 0,
          is_paidout: !!p.is_paidout
        }));
    },
    { ttl: CACHE_TTL.FEED, forceRefresh }
  );
}

/**
 * Fetch all snaps (comments) for a specific container post.
 * The container post itself (depth: 0, author: 'peak.snaps') is strictly excluded.
 * Returns only the top-level user snaps, along with the complete discussion map for subcomments.
 */
export async function getContainerSnaps(
  containerPermlink: string,
  forceRefresh: boolean = false,
  _observer: string = ''
): Promise<ContainerSnapsResult> {
  // Do not forward observer. See getDiscussion.
  const discussion = await getDiscussion('peak.snaps', containerPermlink, forceRefresh);

  const containerKey = `peak.snaps/${containerPermlink}`;
  const rawContainer = discussion[containerKey];

  const container: PeakSnapsContainer = {
    author: 'peak.snaps',
    permlink: containerPermlink,
    title: rawContainer?.title || 'Snaps Container',
    created: rawContainer?.created || '',
    children: rawContainer?.children || 0,
    payout: Number(rawContainer?.payout) || 0,
    is_paidout: !!rawContainer?.is_paidout
  };

  // Filter for top-level snaps: depth === 1, parent_author === 'peak.snaps', exclude depth 0
  const snaps: HivePost[] = [];

  Object.entries(discussion).forEach(([key, post]) => {
    if (!post || !post.author) return;

    // The main container post must NOT appear
    if (post.author === 'peak.snaps' && post.depth === 0) return;

    // Top-level snap comment
    if (post.depth === 1 || post.parent_author === 'peak.snaps') {
      snaps.push(post);
    }
  });

  // Sort snaps newest first (chronological microblog feed)
  snaps.sort((a, b) => hiveTime(b.created) - hiveTime(a.created));

  return {
    container,
    snaps,
    discussionMap: discussion
  };
}

/**
 * Extract subcomments (direct replies) for a given snap from the discussion map
 */
export function getSnapSubcomments(
  snap: HivePost,
  discussionMap: Record<string, HivePost>
): HivePost[] {
  if (!snap.replies || !Array.isArray(snap.replies) || snap.replies.length === 0) {
    // Fallback search in discussionMap where parent_permlink === snap.permlink
    return Object.values(discussionMap).filter(
      (p) => p && p.parent_author === snap.author && p.parent_permlink === snap.permlink
    );
  }

  const subcomments: HivePost[] = [];
  for (const replyKey of snap.replies) {
    const replyPost = discussionMap[replyKey];
    if (replyPost) {
      subcomments.push(replyPost);
    }
  }

  // Sort subcomments in conversational order (oldest to newest)
  subcomments.sort((a, b) => hiveTime(a.created) - hiveTime(b.created));

  return subcomments;
}

export interface ThreadCommentNode {
  comment: HivePost;
  replies: ThreadCommentNode[];
}

/**
 * Recursively build a structured comment tree for a snap or comment
 * from a discussion map. Supports nested comments ("comment of a comment") to arbitrary depth.
 */
export function buildCommentTree(
  parentAuthor: string,
  parentPermlink: string,
  discussionMap: Record<string, HivePost>,
  visited: Set<string> = new Set()
): ThreadCommentNode[] {
  const directReplies: HivePost[] = [];

  // Look up parent in discussionMap to see if replies array is present
  const parentKey = `${parentAuthor}/${parentPermlink}`;
  const parentPost = discussionMap[parentKey];

  if (parentPost && Array.isArray(parentPost.replies) && parentPost.replies.length > 0) {
    for (const replyKey of parentPost.replies) {
      const child = discussionMap[replyKey];
      if (child && !visited.has(`${child.author}/${child.permlink}`)) {
        directReplies.push(child);
      }
    }
  }

  // Also match any child whose parent_author and parent_permlink match
  Object.values(discussionMap).forEach((p) => {
    if (
      p &&
      p.parent_author === parentAuthor &&
      p.parent_permlink === parentPermlink &&
      !visited.has(`${p.author}/${p.permlink}`) &&
      !directReplies.some((d) => d.author === p.author && d.permlink === p.permlink)
    ) {
      directReplies.push(p);
    }
  });

  // Sort direct replies chronologically (oldest to newest)
  directReplies.sort((a, b) => hiveTime(a.created) - hiveTime(b.created));

  // Recursively process each child reply and its nested subcomments
  const tree: ThreadCommentNode[] = [];
  for (const child of directReplies) {
    const key = `${child.author}/${child.permlink}`;
    visited.add(key);
    const childReplies = buildCommentTree(child.author, child.permlink, discussionMap, visited);
    tree.push({
      comment: child,
      replies: childReplies
    });
  }

  return tree;
}

/** Same photo even when one copy is proxied or has a cache query. */
export function imageIdentity(url: string): string {
  let current = url.trim();
  for (let hop = 0; hop < 3; hop++) {
    try {
      const parsed = new URL(current);
      if (parsed.hostname === 'wsrv.nl') {
        const inner = parsed.searchParams.get('url');
        if (!inner) break;
        current = inner.startsWith('http') ? inner : `https://${inner}`;
        continue;
      }
      const wrapped = parsed.pathname.match(/^\/0x0\/(.+)$/);
      if ((parsed.hostname === 'images.hive.blog' || parsed.hostname === 'images.ecency.com') && wrapped) {
        const inner = decodeURIComponent(wrapped[1]);
        current = inner.startsWith('http') ? inner : `https://${inner}`;
        continue;
      }
      return `${parsed.hostname}${decodeURIComponent(parsed.pathname)}`.replace(/\/+$/, '').toLowerCase();
    } catch {
      return current.toLowerCase();
    }
  }
  return current.toLowerCase();
}

export interface HivePostLink {
  author: string;
  permlink: string;
  raw: string;
}

const HIVE_LINK_RE = /https?:\/\/(?:www\.)?(?:peakd\.com|ecency\.com|hive\.blog)\/(?:[a-z0-9-]+\/)?@([a-z0-9.-]+)\/([a-z0-9-]+)/gi;

export function extractHivePostLinks(body: string, self?: { author: string; permlink: string }): HivePostLink[] {
  const seen = new Set<string>();
  const links: HivePostLink[] = [];
  const selfKey = self ? `${self.author.toLowerCase()}/${self.permlink.toLowerCase()}` : '';
  let match: RegExpExecArray | null;
  const source = body || '';
  HIVE_LINK_RE.lastIndex = 0;
  while ((match = HIVE_LINK_RE.exec(source)) !== null) {
    const author = match[1].toLowerCase();
    const permlink = match[2].toLowerCase();
    const key = `${author}/${permlink}`;
    if (key === selfKey || seen.has(key)) continue;
    seen.add(key);
    links.push({ author, permlink, raw: match[0] });
  }
  return links;
}

export function extractHashtags(body: string): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  const hashRegex = /(?:^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g;
  let match: RegExpExecArray | null;
  const source = body || '';
  while ((match = hashRegex.exec(source)) !== null) {
    const tag = match[1].normalize('NFKC').toLowerCase();
    if (tag.length < 2 || /^\d+$/.test(tag) || seen.has(tag)) continue;
    seen.add(tag);
    tags.push(tag);
  }
  return tags;
}

/** Keep the first copy of each hashtag in the text. */
export function collapseDuplicateHashtags(body: string): string {
  const seen = new Set<string>();
  return body.replace(/(^|\s)#([a-zA-Z0-9_\u0080-\uFFFF]+)/g, (full, lead: string, tag: string) => {
    const key = tag.normalize('NFKC').toLowerCase();
    if (seen.has(key)) return lead;
    seen.add(key);
    return full;
  });
}

/** Drop loaded image URLs and resnap links so the text does not repeat the card. */
export function stripResolvedSnapUrls(body: string, urls: string[]): string {
  const exact = new Set(urls.filter(Boolean));
  const keys = new Set(urls.filter(Boolean).map(imageIdentity));
  let next = body.replace(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/gi, (full, url: string) => {
    return exact.has(url) || keys.has(imageIdentity(url)) ? '' : full;
  });
  next = next.replace(/https?:\/\/[^\s<>"')\]]+/gi, (found) => {
    const clean = found.replace(/[),.;]+$/, '');
    const tail = found.slice(clean.length);
    if (exact.has(found) || exact.has(clean) || keys.has(imageIdentity(clean))) return '';
    return clean + tail;
  });
  return next.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Extract image URLs from a Snap markdown body.
 * The same photo is returned once, even if metadata and the body both include it.
 */
export function extractSnapImages(body: string, jsonMetadata?: any): string[] {
  const images: string[] = [];
  const seen = new Set<string>();
  const push = (url: string) => {
    const key = imageIdentity(url);
    if (seen.has(key)) return;
    seen.add(key);
    images.push(url);
  };

  // 1. Check json_metadata image array if available
  if (jsonMetadata) {
    try {
      const meta = typeof jsonMetadata === 'string' ? JSON.parse(jsonMetadata) : jsonMetadata;
      if (Array.isArray(meta.image)) {
        meta.image.forEach((img: any) => {
          if (typeof img === 'string' && img.startsWith('http')) {
            push(img);
          }
        });
      }
    } catch {
      // Ignore parse error
    }
  }

  // 2. Regex for markdown images: ![alt](url)
  const mdRegex = /!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi;
  let match;
  while ((match = mdRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // 3. Regex for raw image URLs ending in jpg, jpeg, png, gif, webp
  const urlRegex = /(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp|svg)(?:\?[^\s<>"']*)?)/gi;
  while ((match = urlRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // 4. IPFS URLs
  const ipfsRegex = /(https?:\/\/[^\s<>"']*ipfs[^\s<>"']+)/gi;
  while ((match = ipfsRegex.exec(body)) !== null) {
    if (match[1]) push(match[1]);
  }

  // Filter out invalid, deceptive or tracking URLs
  return images.filter((url) => {
    if (!url || typeof url !== 'string') return false;
    const lower = url.toLowerCase().trim();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) return false;
    // Exclude tracking pixels, badges, spacer gifs and small icons
    if (lower.includes('1x1') || lower.includes('pixel') || lower.includes('spacer.gif') || lower.includes('badge')) return false;
    return true;
  });
}

/**
 * Clean up microblogging body by stripping image markdown tags
 * so they don't duplicate when rendered in dedicated media cards.
 */
export function cleanSnapBody(body: string): string {
  if (!body) return '';

  return body
    // Remove markdown images: ![...](...)
    .replace(/!\[.*?\]\((https?:\/\/[^\s\)]+)\)/gi, '')
    // Remove standalone image URLs
    .replace(/(?:^|\s)(https?:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|gif|webp)(?:\?[^\s<>"']*)?)(?=\s|$)/gi, '')
    // Remove bot/app footer signatures
    .replace(/<sub>.*?Posted (?:via|using).*?<\/sub>/gi, '')
    .trim();
}
